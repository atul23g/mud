"""Parse lab values from text or OCR tokens using synonyms and fuzzy matching.

Adds a token-aware parser that groups by line numbers and finds nearest numeric
values/units next to detected label synonyms. This helps multi-page PDFs and
noisy scans where regex over full text is brittle.
"""

import re
import json
from rapidfuzz import fuzz, process
from pathlib import Path
from typing import Dict, Any, List, Tuple
from .advanced_pdf_extractor import extract_pdf_advanced

# Load lab mapping
LABS_PATH = Path("src/config/labs_map.json")
if LABS_PATH.exists():
    LABS = json.loads(LABS_PATH.read_text())
else:
    LABS = {}

CANONICALS = list(LABS.keys())
UNIT_CANON = {}
if Path("src/config/units.json").exists():
    UNIT_CANON = json.loads(Path("src/config/units.json").read_text())


def _norm(s: str) -> str:
    """Normalize string: lowercase, remove extra spaces."""
    return re.sub(r"\s+", " ", s.lower()).strip()


def find_canonical(label: str):
    """
    Find canonical lab name from label using synonyms and fuzzy matching.
    
    Args:
        label: Raw lab name from PDF
        
    Returns:
        str or None: Canonical lab name if found
    """
    label = _norm(label)
    
    # Try exact match or contains match first
    for k, syns in LABS.items():
        for syn in syns:
            if syn.lower() in label or label in syn.lower():
                return k
    
    # Fuzzy matching as last resort
    if CANONICALS:
        best = process.extractOne(label, CANONICALS, scorer=fuzz.token_set_ratio)
        if best and best[1] >= 80:  # 80% similarity threshold
            return best[0]
    
    return None


# Pattern to match: "Lab Name: value unit" or "Lab Name value unit"
VAL_PAT = re.compile(
    r"([a-zA-Z %/().-]{2,50})[:\s]+([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z%/²]+)?",
    re.IGNORECASE
)


def parse_text_to_pairs(text: str):
    """
    Parse text to extract lab name, value, and unit pairs.
    
    Args:
        text: Raw text from PDF
        
    Returns:
        list: List of tuples (canonical_lab_name, value, unit)
    """
    pairs = []
    
    for m in VAL_PAT.finditer(text):
        raw_lab = m.group(1).strip()
        val_str = m.group(2)
        unit = (m.group(3) or "").strip().lower()
        
        try:
            val = float(val_str)
            # Find canonical lab name
            lab = find_canonical(raw_lab)
            if lab:
                pairs.append((lab, val, unit))
        except ValueError:
            continue
    
    return pairs


def coalesce_pairs(pairs):
    """
    Coalesce duplicate lab entries (keep first occurrence).
    
    Args:
        pairs: List of (lab, value, unit) tuples
        
    Returns:
        dict: Dictionary mapping lab name to (value, unit) tuple
    """
    out = {}
    for lab, val, unit in pairs:
        if lab not in out:
            out[lab] = (val, unit)
    return out


def parse_with_advanced_extractor(pdf_path: str) -> Dict[str, Any]:
    """
    Parse PDF using advanced deep learning extraction pipeline.
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Dictionary containing extracted lab values and metadata
    """
    # Use advanced extractor
    extraction_result = extract_pdf_advanced(pdf_path)
    
    # Convert entities to the format expected by the system
    extracted_values = {}
    extracted_meta = {}
    
    if 'entities' in extraction_result:
        for entity, data in extraction_result['entities'].items():
            if isinstance(data, dict) and 'value' in data:
                extracted_values[entity] = data['value']
                extracted_meta[entity] = {
                    'value': data['value'],
                    'unit': data.get('unit', ''),
                    'confidence': data.get('confidence', 0.9),
                    'source': 'advanced_extractor'
                }
    
    # Also parse the raw text for additional values
    text = extraction_result.get('text', '')
    if text:
        text_pairs = parse_text_to_pairs(text)
        for lab, val, unit in text_pairs:
            if lab not in extracted_values:  # Don't overwrite higher confidence values
                extracted_values[lab] = val
                extracted_meta[lab] = {
                    'value': val,
                    'unit': unit,
                    'confidence': 0.7,
                    'source': 'text_parsing'
                }
    
    return {
        'extracted': extracted_values,
        'extracted_meta': extracted_meta,
        'text': text,
        'extraction_methods': extraction_result.get('extraction_methods', []),
        'overall_confidence': extraction_result.get('metadata', {}).get('overall_confidence', 0.0)
    }

def parse_tokens_to_pairs(ocr: Dict[str, Any]) -> List[Tuple[str, float, str]]:
    """Parse using OCR tokens with line grouping and proximity search.

    ocr format expected from pdf_to_ocr_tokens():
    { 'pages': [ { 'tokens': [ {text, conf, x,y,w,h, line_num, word_num}, ...] }, ... ] }
    """
    results: List[Tuple[str, float, str]] = []
    if not ocr or 'pages' not in ocr:
        return results

    # Build synonym lookup list
    syn_lookup: List[Tuple[str, str]] = []  # (canonical, synonym)
    for canon, syns in LABS.items():
        for s in syns:
            syn_lookup.append((canon, s.lower()))

    for page in ocr.get('pages', []):
        tokens = page.get('tokens', []) or []
        # Group tokens by line_num to search neighbors
        lines: Dict[int, List[Dict[str, Any]]] = {}
        for t in tokens:
            ln = int(t.get('line_num') or 0)
            lines.setdefault(ln, []).append(t)
        for ln in sorted(lines.keys()):
            row = lines[ln]
            # Sort by x to get left-to-right
            row.sort(key=lambda t: (int(t.get('x') or 0)))
            # Build joined lower text for quick contains check
            joined = " ".join([str(t.get('text') or '') for t in row]).lower()
            # Try each synonym present in this line
            for canon, syn in syn_lookup:
                if syn in joined:
                    # Find the approximate center x of the label span by first token that contains a chunk of the synonym
                    label_indices = [i for i, tk in enumerate(row) if syn.split()[0] in str(tk.get('text','')).lower()]
                    start_idx = label_indices[0] if label_indices else 0
                    # Search to the right for a numeric token, else search entire line
                    num_idx = None
                    num_val = None
                    unit_val = ""
                    num_pat = re.compile(r"^[+-]?(?:\d+\.?\d*|\.\d+)$")
                    for i in range(start_idx, len(row)):
                        txt = str(row[i].get('text') or '').strip()
                        if num_pat.match(txt):
                            try:
                                num_val = float(txt)
                                num_idx = i
                                break
                            except ValueError:
                                pass
                    if num_idx is None:
                        # fallback: scan entire line
                        for i in range(len(row)):
                            txt = str(row[i].get('text') or '').strip()
                            if num_pat.match(txt):
                                try:
                                    num_val = float(txt)
                                    num_idx = i
                                    break
                                except ValueError:
                                    pass
                    if num_idx is not None and num_val is not None:
                        # Look at immediate next token for unit letters
                        if num_idx + 1 < len(row):
                            nxt = str(row[num_idx+1].get('text') or '')
                            if re.search(r"[a-zA-Z%]", nxt):
                                unit_val = nxt
                        results.append((canon, num_val, unit_val.lower()))
    return results
