"""
Advanced PDF/Image extraction pipeline using deep learning and computer vision.
Handles both text-based PDFs and scanned images with maximum extraction accuracy.
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
import pdfplumber
import fitz  # PyMuPDF
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import torch
import torch.nn as nn
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
import io
import re
import json
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AdvancedPDFExtractor:
    """
    Advanced PDF extractor that combines multiple techniques:
    - Deep learning OCR (TrOCR) for better text recognition
    - Computer vision preprocessing for image enhancement
    - Multi-modal extraction for PDFs with embedded images
    - Confidence scoring and validation
    """
    
    def __init__(self):
        self.trocr_processor = None
        self.trocr_model = None
        self._load_models()
    
    def _load_models(self):
        """Load deep learning models for enhanced OCR"""
        try:
            # Load TrOCR model for better text recognition
            self.trocr_processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-printed')
            self.trocr_model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-printed')
            logger.info("TrOCR model loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load TrOCR model: {e}. Using traditional OCR.")
    
    def enhance_image(self, image: Image.Image) -> Image.Image:
        """
        Enhance image quality for better OCR results
        
        Args:
            image: PIL Image to enhance
            
        Returns:
            Enhanced PIL Image
        """
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        
        # Enhance sharpness
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(2.0)
        
        # Apply noise reduction
        image = image.filter(ImageFilter.MedianFilter(size=3))
        
        # Convert to numpy array for OpenCV processing
        img_array = np.array(image)
        
        # Apply adaptive thresholding for better text extraction
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # Apply different thresholding techniques
        _, thresh1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        thresh2 = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY, 11, 2)
        
        # Use the better thresholded image
        if np.mean(thresh1) > np.mean(thresh2):
            final_thresh = thresh1
        else:
            final_thresh = thresh2
        
        # Convert back to PIL Image
        enhanced_image = Image.fromarray(final_thresh)
        
        return enhanced_image
    
    def extract_text_with_tr_ocr(self, image: Image.Image) -> Tuple[str, float]:
        """
        Extract text using TrOCR deep learning model
        
        Args:
            image: PIL Image to process
            
        Returns:
            Tuple of (extracted_text, confidence_score)
        """
        if self.trocr_processor is None or self.trocr_model is None:
            return "", 0.0
        
        try:
            # Preprocess image
            pixel_values = self.trocr_processor(images=image, return_tensors="pt").pixel_values
            
            # Generate text
            generated_ids = self.trocr_model.generate(pixel_values, max_length=512)
            generated_text = self.trocr_processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            
            # Calculate confidence based on generation probabilities
            with torch.no_grad():
                outputs = self.trocr_model(pixel_values, labels=generated_ids)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=-1)
                confidence = torch.mean(torch.max(probs, dim=-1)[0]).item()
            
            return generated_text, confidence
        except Exception as e:
            logger.error(f"TrOCR extraction failed: {e}")
            return "", 0.0
    
    def extract_medical_entities(self, text: str) -> Dict[str, Any]:
        """
        Extract medical entities and values from text using regex patterns
        
        Args:
            text: Raw text to analyze
            
        Returns:
            Dictionary of extracted medical entities
        """
        entities = {}
        
        # Common medical patterns
        patterns = {
            # Blood pressure
            'blood_pressure': r'(?:BP|Blood Pressure)[\s:]*(\d{2,3})/\s*(\d{2,3})',
            # Heart rate
            'heart_rate': r'(?:HR|Heart Rate|Pulse)[\s:]*(\d{2,3})\s*(?:bpm|beats? per minute)?',
            # Temperature
            'temperature': r'(?:Temp|Temperature)[\s:]*(\d{2,3}(?:\.\d{1,2})?)\s*°?[FC]',
            # Blood sugar/glucose
            'glucose': r'(?:Glucose|Blood Sugar|BS)[\s:]*(\d{2,3}(?:\.\d{1,2})?)\s*(?:mg/dL|mg/dl)?',
            # Cholesterol
            'cholesterol': r'(?:Cholesterol|Chol)[\s:]*(\d{2,4}(?:\.\d{1,2})?)\s*(?:mg/dL|mg/dl)?',
            # Hemoglobin
            'hemoglobin': r'(?:Hemoglobin|Hb|HGB)[\s:]*(\d{1,2}(?:\.\d{1,2})?)\s*(?:g/dL|g/dl)?',
            # White blood cells
            'wbc': r'(?:WBC|White Blood Cells?)[\s:]*(\d{1,2}(?:\.\d{1,2})?)\s*(?:K/uL|k/uL|×10³/μL)?',
            # Platelets
            'platelets': r'(?:Platelets?|PLT)[\s:]*(\d{2,4}(?:\.\d{1,2})?)\s*(?:K/uL|k/uL|×10³/μL)?',
            # Age
            'age': r'(?:Age|Patient Age)[\s:]*(\d{1,3})\s*(?:years?|yrs?|y)?',
            # Weight
            'weight': r'(?:Weight|Wt)[\s:]*(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg|Kg|KG)?',
            # Height
            'height': r'(?:Height|Ht)[\s:]*(\d{2,3}(?:\.\d{1,2})?)\s*(?:cm|Cm|CM)?',
        }
        
        for entity, pattern in patterns.items():
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                # Take the first valid match
                if isinstance(matches[0], tuple):
                    value = '/'.join(matches[0]) if entity == 'blood_pressure' else matches[0][0]
                else:
                    value = matches[0]
                
                try:
                    # Clean and validate the value
                    if entity == 'blood_pressure':
                        systolic, diastolic = value.split('/')
                        entities[entity] = {
                            'value': value,
                            'systolic': float(systolic),
                            'diastolic': float(diastolic),
                            'unit': 'mmHg',
                            'confidence': 0.9
                        }
                    else:
                        numeric_value = float(value)
                        entities[entity] = {
                            'value': numeric_value,
                            'unit': self._get_unit_for_entity(entity),
                            'confidence': 0.9
                        }
                except ValueError:
                    continue
        
        return entities
    
    def _get_unit_for_entity(self, entity: str) -> str:
        """Get standard unit for medical entity"""
        units = {
            'blood_pressure': 'mmHg',
            'heart_rate': 'bpm',
            'temperature': '°C',
            'glucose': 'mg/dL',
            'cholesterol': 'mg/dL',
            'hemoglobin': 'g/dL',
            'wbc': 'K/uL',
            'platelets': 'K/uL',
            'age': 'years',
            'weight': 'kg',
            'height': 'cm'
        }
        return units.get(entity, '')
    
    def extract_from_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """
        Main extraction function that handles both text and image-based PDFs
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Dictionary containing extracted data and metadata
        """
        logger.info(f"Starting advanced extraction for: {pdf_path}")
        
        result = {
            'text': '',
            'entities': {},
            'pages_processed': 0,
            'extraction_methods': [],
            'confidence_scores': [],
            'metadata': {
                'filename': Path(pdf_path).name,
                'processed_at': datetime.now().isoformat(),
                'total_pages': 0
            }
        }
        
        try:
            # First try text-based extraction
            text_result = self._extract_text_content(pdf_path)
            result['text'] = text_result['text']
            result['extraction_methods'].extend(text_result['methods'])
            result['confidence_scores'].append(text_result['confidence'])
            
            # If text extraction didn't work well, try OCR
            if text_result['confidence'] < 0.7:
                ocr_result = self._extract_with_ocr(pdf_path)
                if ocr_result['text'] and ocr_result['confidence'] > text_result['confidence']:
                    result['text'] = ocr_result['text']
                    result['extraction_methods'].extend(ocr_result['methods'])
                    result['confidence_scores'].append(ocr_result['confidence'])
            
            # Extract medical entities from combined text
            entities = self.extract_medical_entities(result['text'])
            result['entities'] = entities
            
            # Calculate overall confidence
            if result['confidence_scores']:
                result['metadata']['overall_confidence'] = np.mean(result['confidence_scores'])
            
            logger.info(f"Extraction completed. Methods used: {result['extraction_methods']}")
            
        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            result['error'] = str(e)
        
        return result
    
    def _extract_text_content(self, pdf_path: str) -> Dict[str, Any]:
        """Extract text content using pdfplumber and PyMuPDF"""
        result = {'text': '', 'methods': [], 'confidence': 0.0}
        
        try:
            # Try pdfplumber first
            with pdfplumber.open(pdf_path) as pdf:
                text_chunks = []
                for page in pdf.pages:
                    text = page.extract_text()
                    if text and text.strip():
                        text_chunks.append(text)
                
                if text_chunks:
                    result['text'] = '\n'.join(text_chunks)
                    result['methods'].append('pdfplumber')
                    result['confidence'] = 0.8
                    return result
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}")
        
        try:
            # Try PyMuPDF
            doc = fitz.open(pdf_path)
            text_chunks = []
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()
                if text and text.strip():
                    text_chunks.append(text)
            doc.close()
            
            if text_chunks:
                result['text'] = '\n'.join(text_chunks)
                result['methods'].append('pymupdf')
                result['confidence'] = 0.7
        except Exception as e:
            logger.warning(f"PyMuPDF failed: {e}")
        
        return result
    
    def _extract_with_ocr(self, pdf_path: str) -> Dict[str, Any]:
        """Extract text using OCR with image enhancement"""
        result = {'text': '', 'methods': [], 'confidence': 0.0}
        
        try:
            doc = fitz.open(pdf_path)
            text_chunks = []
            confidence_scores = []
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                
                # Get page as image
                pix = page.get_pixmap(dpi=300)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                
                # Enhance image
                enhanced_img = self.enhance_image(img)
                
                # Try TrOCR first
                if self.trocr_processor and self.trocr_model:
                    trocr_text, trocr_conf = self.extract_text_with_tr_ocr(enhanced_img)
                    if trocr_text and trocr_conf > 0.5:
                        text_chunks.append(trocr_text)
                        confidence_scores.append(trocr_conf)
                        result['methods'].append(f'trocr_page_{page_num}')
                        continue
                
                # Fallback to Tesseract
                try:
                    ocr_text = pytesseract.image_to_string(enhanced_img)
                    if ocr_text and ocr_text.strip():
                        text_chunks.append(ocr_text)
                        confidence_scores.append(0.6)  # Default confidence for Tesseract
                        result['methods'].append(f'tesseract_page_{page_num}')
                except Exception as e:
                    logger.warning(f"Tesseract failed for page {page_num}: {e}")
            
            doc.close()
            
            if text_chunks:
                result['text'] = '\n'.join(text_chunks)
                result['confidence'] = np.mean(confidence_scores) if confidence_scores else 0.6
            
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
        
        return result


# Global extractor instance
_extractor = None

def get_extractor() -> AdvancedPDFExtractor:
    """Get or create global extractor instance"""
    global _extractor
    if _extractor is None:
        _extractor = AdvancedPDFExtractor()
    return _extractor

def extract_pdf_advanced(pdf_path: str) -> Dict[str, Any]:
    """
    Convenience function to extract PDF using advanced techniques
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Dictionary containing extracted data and metadata
    """
    extractor = get_extractor()
    return extractor.extract_from_pdf(pdf_path)