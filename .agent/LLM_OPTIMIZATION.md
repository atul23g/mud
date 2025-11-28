# Medical Report Analysis Flow - Optimized to Minimize LLM API Calls

## Current Implementation ✅

The system is already optimized to avoid redundant LLM API calls. Here's how it works:

### 1. Upload & Extract (First Time - Uses LLM)
**Endpoint**: `POST /api/ingest/report`
**What happens**:
- User uploads PDF
- LLM (GPT-4o-mini) extracts medical values from the PDF text
- Report is saved to database with:
  - `extracted`: The extracted feature values
  - `extractedMeta`: Metadata including units, confidence, ranges
  - `rawOCR`: The full extracted text from PDF
  - `missingFields`: Fields that weren't found
- Report appears in History immediately

**API Call Count**: 1 LLM call (necessary)

### 2. View in History (No API calls)
**Endpoint**: `GET /api/history/reports`
**What happens**:
- Fetches all reports from database
- Displays them with extracted values
- Shows when extraction was done

**API Call Count**: 0 LLM calls (just database query)

### 3. Click "Analyze" from History (No LLM calls)
**What happens**:
- Navigates to Upload page
- Pre-fills all extracted values from the stored report
- User can review/edit values if needed
- No new extraction happens

**API Call Count**: 0 LLM calls (uses stored values)

### 4. Run Analysis/Prediction (No LLM calls)
**Endpoint**: `POST /api/predict/with_features`
**What happens**:
- Takes the extracted features (from step 1)
- Runs ML model prediction only
- Calculates health score
- Saves prediction to database
- Links prediction to original report

**API Call Count**: 0 LLM calls (only ML model inference)

## Summary

**Total LLM API Calls Per Report**: 1 (only during initial upload/extraction)

All subsequent operations (viewing history, re-analyzing, generating predictions) use the stored extracted values, avoiding redundant LLM calls.

## Flow Diagram

```
Upload PDF → LLM Extract (1 call) → Save to DB → Show in History
                                          ↓
                                    Click "Analyze"
                                          ↓
                                   Pre-fill Values
                                          ↓
                                    Run ML Prediction (0 LLM calls)
                                          ↓
                                   Save Prediction → Link to Report
```

## Why This is Efficient

1. **Single Extraction**: Each PDF is only processed by the LLM once
2. **Persistent Storage**: Extracted values are stored in PostgreSQL
3. **Reusable Data**: Same extracted values can be used for multiple analyses
4. **No Re-extraction**: When viewing history or re-analyzing, we use stored data
5. **Prediction is Separate**: ML model predictions don't require LLM calls

## Cost Savings Example

**Without this optimization**:
- Upload PDF: 1 LLM call
- View in History: 1 LLM call (re-extract)
- Analyze again: 1 LLM call (re-extract)
- **Total**: 3 LLM calls

**With current optimization**:
- Upload PDF: 1 LLM call
- View in History: 0 LLM calls (use stored)
- Analyze again: 0 LLM calls (use stored)
- **Total**: 1 LLM call

**Savings**: 67% reduction in LLM API costs per report!
