# MediSense AI - Medical Report Intelligence System

A comprehensive medical report extraction and analysis system that uses AI to extract health data from PDF reports, predict disease risks, and provide professional medical triage advice.

## Features

- **PDF Report Processing**: Advanced OCR and text extraction from medical reports
- **Multi-Disease Prediction**: Support for Heart Disease, Diabetes, Parkinson's, and Anemia
- **AI-Powered Triage**: Professional medical advice using LLM technology
- **Health Scoring**: Comprehensive health assessment with risk breakdown
- **Dr. Intelligence Chatbot**: Interactive medical consultation interface
- **Report History**: Complete patient report management and tracking

## Tech Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **Prisma**: Modern database ORM with Neon Postgres
- **JWT Authentication**: Secure token-based authentication
- **LLM Integration**: Gemini and Groq for medical advice
- **OCR**: Tesseract for text extraction from PDFs
- **Machine Learning**: Scikit-learn for disease prediction models

### Frontend
- **React 18**: Modern React with TypeScript
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Zustand**: Lightweight state management
- **React Router**: Client-side routing

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Tesseract OCR (`brew install tesseract` on macOS)

### Backend Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and database credentials

# Run database migrations
prisma generate
prisma db push

# Start the API server
make api
```

### Frontend Setup
```bash
cd web
npm install
npm run dev
```

### Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Variable Details

### Backend Environment
- `DATABASE_URL`: Postgres connection string used by Prisma client
- `JWT_SECRET`: Secret for signing/verifying API auth tokens
- `ALLOWED_ORIGINS`: Comma-separated origins allowed for CORS (default `*`)
- `ALLOWED_HOSTS`: Comma-separated hostnames for Trusted Host middleware (default `*`)
- `FORCE_HTTPS`: `true|false` to enable HTTPS redirect middleware in production
- `GEMINI_API_KEY`: Google Gemini key for triage LLM
- `GROQ_API_KEY`: Groq key for alternative LLM

### Frontend Environment
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key for auth widgets
- `VITE_API_BASE`: Base URL for API (defaults to `http://localhost:8000`)
- `VITE_DISABLE_AUTH`: `true|false` to bypass Clerk during local development

## Compilation & Usage Procedure

### Backend
1. Install: `pip install -r requirements.txt`
2. Environment: `cp .env.example .env`, then set variables
3. Prisma: `python -m prisma generate`, `python -m prisma db push`
4. Run dev: `make api` (Uvicorn with reload)
5. Run prod: `bash scripts/start_prod.sh` (Gunicorn, binds to `PORT` if provided)

### Frontend
1. `cd web && npm install`
2. Dev: `npm run dev` (Vite server)
3. Build: `npm run build`
4. Preview: `npm run preview` (serve built assets)

## Hardware/Software Requirements
- Python 3.11+
- Node.js 18+
- Postgres database (Neon/Railway/Cloud Postgres)
- Optional OCR: Tesseract (`brew install tesseract` on macOS) for enhanced PDF text extraction
- Recommended: 2+ CPU cores, 4GB+ RAM for smoother model inference

## Public Domain/Open-Source Software Sources
- FastAPI — https://fastapi.tiangolo.com/
- Prisma Client Python — https://github.com/RobertCraigie/prisma-client-py
- Uvicorn/Gunicorn — https://www.uvicorn.org/ / https://gunicorn.org/
- scikit-learn — https://scikit-learn.org/
- pdfplumber — https://github.com/jsvine/pdfplumber
- PyMuPDF — https://pymupdf.readthedocs.io/
- Tesseract OCR — https://github.com/tesseract-ocr/tesseract
- React — https://react.dev/
- Vite — https://vitejs.dev/
- Clerk — https://clerk.com/
- Axios — https://axios-http.com/

## Acknowledgments
This software relies on the open-source projects listed above. Their licenses and documentation should be consulted for detailed terms of use. Any third-party modules used are properly acknowledged here and via their respective documentation links.

## Distribution Media
When distributing the project on physical media:
- Provide a virus-free disk containing:
  - The compiled frontend build (`web/dist`) or instructions to build
  - Backend source with `requirements.txt`
  - This README
- Include environment templates without secrets (`.env.example`, `web/.env.example`)
- Provide a separate note listing third-party software sources and modules (see “Public Domain/Open-Source Software Sources” above)

## API Endpoints

### Authentication
- `POST /auth/clerk_sync` - Sync Clerk user authentication

### Report Processing
- `POST /ingest/report` - Upload and process PDF reports
- `GET /features/schema` - Get feature schema for diseases
- `POST /features/complete` - Complete feature extraction

### Prediction & Triage
- `POST /predict/with_features` - Get disease predictions
- `POST /triage` - Get AI-powered medical advice

### History
- `GET /history/reports` - Get user report history
- `GET /health` - System health check

## Environment Variables

### Required
- `DATABASE_URL` - Neon Postgres database connection string
- `JWT_SECRET` - Secret key for JWT token generation

### Optional
- `GEMINI_API_KEY` - Google Gemini API key for LLM
- `GROQ_API_KEY` - Groq API key for alternative LLM
- `ALLOWED_ORIGINS` - CORS allowed origins (default: *)
- `ALLOWED_HOSTS` - Allowed hostnames for security

## Production Deployment

### Using Docker
```bash
# Build and run with Docker
docker build -t medisense-ai .
docker run -p 8000:8000 --env-file .env medisense-ai
```

### Using Vercel (Frontend)
```bash
cd web
vercel deploy
```

### Environment Configuration
Set production environment variables in your deployment platform:
- Database connection string
- API keys for LLM services
- JWT secret for authentication
- CORS and security settings

## Disease Models

### Heart Disease Prediction
Uses 13 clinical features including age, sex, chest pain type, blood pressure, cholesterol, and ECG results.

### Diabetes Prediction
Analyzes glucose levels, BMI, age, and other metabolic indicators.

### Parkinson's Detection
Processes voice recordings and clinical measurements for early detection.

### Anemia Assessment
Evaluates hemoglobin levels, RBC count, and related blood parameters.

## Health Scoring System

The system provides a comprehensive health score (0-100) with:
- **Risk Assessment**: Disease probability analysis
- **Feature Breakdown**: Top contributing factors
- **Personalized Recommendations**: Lifestyle and medical advice
- **Confidence Scoring**: Reliability indicators for predictions

## Security Features

- JWT-based authentication
- Input validation and sanitization
- CORS protection
- Rate limiting capabilities
- Secure file upload handling
- Database connection security

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This system is for educational and informational purposes only. It should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical decisions.