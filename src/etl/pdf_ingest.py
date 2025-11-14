"""PDF extraction helpers: text and OCR tokens with confidences.

Provides:
- pdf_to_text: best-effort plain text (existing)
- pdf_to_ocr_tokens: per-page OCR tokens with bbox and confidence (multi-page)
"""

from pathlib import Path
import pdfplumber
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
from typing import List, Dict, Any
import csv


def pdf_to_text(path: str) -> str:
    """
    Extract text from PDF (digital or scanned).
    
    Args:
        path: Path to PDF file
        
    Returns:
        str: Extracted text
    """
    # Handle both string and Path objects
    if isinstance(path, Path):
        p = path
    else:
        p = Path(path)
    
    # If relative path, try to resolve from current working directory
    if not p.is_absolute():
        # Try current directory first
        if not p.exists():
            # Try from project root
            project_root = Path(__file__).parent.parent.parent
            p = project_root / path
        if not p.exists():
            # Try as absolute path
            p = Path(path).resolve()
    
    # Final check - try to open the file to verify it exists
    # Sometimes Path.exists() returns False even when file exists (encoding issues)
    # So we try to actually open it
    file_exists = False
    if p.exists():
        file_exists = True
    else:
        # Try opening the file directly
        try:
            with open(str(p), 'rb') as f:
                file_exists = True
        except (FileNotFoundError, OSError):
            # Try with original path string
            try:
                with open(path, 'rb') as f:
                    file_exists = True
                    p = Path(path)
            except (FileNotFoundError, OSError):
                pass
    
    if not file_exists:
        raise FileNotFoundError(f"PDF not found: {path}\nTried: {p.absolute()}")
    
    text_chunks = []
    
    # Method 1: Try pdfplumber first (for digital PDFs with text)
    try:
        with pdfplumber.open(str(p)) as pdf:
            for page in pdf.pages:
                t = page.extract_text() or ""
                if t.strip():
                    text_chunks.append(t)
        
        # If we got text, return it
        if any(text_chunks):
            return "\n".join(text_chunks)
    except Exception as e:
        print(f"pdfplumber failed: {e}, trying PyMuPDF...")
    
    # Method 2: Try PyMuPDF native text extraction (faster than OCR)
    try:
        doc = fitz.open(str(p))
        for page_num in range(len(doc)):
            page = doc[page_num]
            # Try to extract text directly (works for some image PDFs)
            text = page.get_text()
            if text.strip():
                text_chunks.append(text)
        doc.close()
        
        if text_chunks:
            return "\n".join(text_chunks)
    except Exception as e:
        print(f"PyMuPDF text extraction failed: {e}, trying OCR...")
    
    # Method 3: Fallback to OCR for scanned PDFs (image-based)
    try:
        doc = fitz.open(str(p))
        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text = pytesseract.image_to_string(img)
            if text.strip():
                text_chunks.append(text)
        doc.close()
        
        if text_chunks:
            return "\n".join(text_chunks)
    except Exception as e:
        print(f"OCR failed: {e}")
        print("Note: Install Tesseract for OCR support: brew install tesseract (macOS)")
    
    # If all methods failed, return empty string
    return ""


def _ensure_path(path: str | Path) -> Path:
    if isinstance(path, Path):
        p = path
    else:
        p = Path(path)
    if not p.is_absolute():
        if not p.exists():
            project_root = Path(__file__).parent.parent.parent
            p = project_root / str(path)
        if not p.exists():
            p = Path(path).resolve()
    if not p.exists():
        raise FileNotFoundError(f"PDF not found: {path}")
    return p


def pdf_to_ocr_tokens(path: str, dpi: int = 300) -> Dict[str, Any]:
    """
    OCR the PDF into per-page tokens with bounding boxes and confidences.
    Uses Tesseract TSV output for robust token-level data.

    Returns structure:
    {
      'pages': [
        {
          'width': int,
          'height': int,
          'tokens': [ { 'text': str, 'conf': float, 'x': int, 'y': int, 'w': int, 'h': int, 'line_num': int, 'word_num': int } ... ]
        }, ...
      ]
    }
    """
    p = _ensure_path(path)
    out: Dict[str, Any] = { 'pages': [] }
    try:
        doc = fitz.open(str(p))
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            pix = page.get_pixmap(dpi=dpi)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            # Use TSV to get confidences and bounding boxes
            tsv = pytesseract.image_to_data(img, output_type=pytesseract.Output.DATAFRAME)  # pandas if available
            tokens: List[Dict[str, Any]] = []
            if tsv is not None:
                try:
                    # Convert pandas-like to dict rows without requiring pandas import at runtime
                    for _, row in tsv.iterrows():  # type: ignore[attr-defined]
                        text = str(row.get('text', '') or '').strip()
                        conf = float(row.get('conf', -1))
                        if not text:
                            continue
                        tokens.append({
                            'text': text,
                            'conf': conf if conf >= 0 else 0.0,
                            'x': int(row.get('left', 0)),
                            'y': int(row.get('top', 0)),
                            'w': int(row.get('width', 0)),
                            'h': int(row.get('height', 0)),
                            'line_num': int(row.get('line_num', 0) or 0),
                            'word_num': int(row.get('word_num', 0) or 0),
                        })
                except Exception:
                    # Fallback to TSV string parsing to avoid pandas dependency mismatch
                    tsv_text = pytesseract.image_to_data(img)
                    reader = csv.DictReader(io.StringIO(tsv_text), delimiter='\t')
                    for row in reader:
                        text = (row.get('text') or '').strip()
                        if not text:
                            continue
                        conf = float(row.get('conf') or 0)
                        tokens.append({
                            'text': text,
                            'conf': conf,
                            'x': int(row.get('left') or 0),
                            'y': int(row.get('top') or 0),
                            'w': int(row.get('width') or 0),
                            'h': int(row.get('height') or 0),
                            'line_num': int(row.get('line_num') or 0),
                            'word_num': int(row.get('word_num') or 0),
                        })
            out['pages'].append({
                'width': pix.width,
                'height': pix.height,
                'tokens': tokens,
            })
        doc.close()
    except Exception as e:
        # If OCR fails, return empty tokens with error note
        return { 'pages': [], 'error': f'OCR failed: {e}' }
    return out
