# Quarterly Progress Report Notes

A mobile-first web application for Maryland public school teachers to upload student work images, perform OCR, extract data tables, and generate structured quarterly progress report summaries using Mistral AI.

## Features

- **Mobile-First Design**: Optimized for phone and tablet use with responsive UI
- **Image Upload**: Upload images from camera or file system
- **OCR Processing**: Extract text from images using Mistral AI or Tesseract OCR
- **Table Extraction**: Automatically identify and extract tables from OCR text
- **Structured Summaries**: Generate professional quarterly progress reports aligned with Maryland State Department of Education (MSDE) standards
- **Stateful Sessions**: Maintain state across the workflow (upload → OCR → tables → summary)
- **PWA Support**: Installable as a Progressive Web App for offline use

## Maryland Public School Compliance

The application generates progress reports that align with:
- Maryland College and Career Ready Standards (MCCRS)
- Next Generation Science Standards (NGSS)
- Maryland Social Studies Standards
- IEP (Individualized Education Program) goal tracking
- Behavioral and social-emotional progress reporting

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │  Upload     │  │  Image       │  │  Report Generation           │  │
│  │  Component  │──▶│  Preview     │──▶│  Component                   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
└────────┬──────────────────┬────────────────────┬────────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │  /upload    │  │  /ocr       │  │  /generate-summary           │  │
│  │  Endpoint   │──▶│  Endpoint   │──▶│  Endpoint                    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
└────────┬──────────────────┬────────────────────┬────────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                            │
│  ┌─────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  Image Storage       │  │  Mistral AI API                        │  │
│  │  (Local/Cloud)       │  │  - OCR Model                           │  │
│  └─────────────────────┘  │  - LLM for Summary Generation         │  │
│                          └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)
- Mistral AI API key (optional, for OCR and LLM features)

### Using Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/sam-hartman/Quarterly-progress-report-notes-.git
   cd Quarterly-progress-report-notes-
   ```

2. Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your Mistral API key:
   ```
   MISTRAL_API_KEY=your_api_key_here
   ```

4. Start the services:
   ```bash
   docker-compose up -d
   ```

5. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

### Local Development

1. Set up backend:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your settings
   uvicorn app.main:app --reload
   ```

2. Set up frontend:
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Edit .env with your settings
   npm run dev
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000

## Configuration

### Environment Variables

#### Backend (`.env` in `/backend`)
```
DEBUG=true
HOST=0.0.0.0
PORT=8000
MISTRAL_API_KEY=your_mistral_api_key
MISTRAL_API_URL=https://api.mistral.ai/v1
MISTRAL_OCR_MODEL=mistral-ocr-latest
MISTRAL_LLM_MODEL=mistral-large-latest
MAX_IMAGE_SIZE_MB=10
UPLOAD_DIR=./uploads
TEMP_DIR=./temp
IMAGE_RETENTION_HOURS=24
CORS_ORIGINS=http://localhost:3000,http://localhost
SESSION_TIMEOUT=3600
```

#### Frontend (`.env` in `/frontend`)
```
VITE_API_URL=http://localhost:8000/api
VITE_MISTRAL_API_KEY=your_mistral_api_key
```

## API Endpoints

### Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/sessions` | Create new session |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/{id}` | Get session details |
| POST | `/api/upload` | Upload image |
| POST | `/api/ocr` | Process OCR on image |
| POST | `/api/extract-tables` | Extract tables from text |
| POST | `/api/generate-summary` | Generate summary from text |

### Request Examples

**Upload Image:**
```bash
curl -X POST -F "file=@student_work.jpg" http://localhost:8000/api/upload
```

**Process OCR:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"image_id": "uuid", "language": "eng", "enhance_image": true}' \
  http://localhost:8000/api/ocr
```

**Generate Summary:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "text": "Extracted OCR text...",
    "template": "maryland_qpr",
    "grade_level": "3",
    "subject": "Reading",
    "student_name": "John Doe",
    "include_standards": true
  }' \
  http://localhost:8000/api/generate-summary
```

## Project Structure

```
quarterly-progress-report/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # Configuration
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic models
│   │   ├── routes/
│   │   │   ├── upload.py
│   │   │   ├── ocr.py
│   │   │   ├── tables.py
│   │   │   └── summary.py
│   │   ├── services/
│   │   │   ├── mistral_client.py # Mistral AI integration
│   │   │   ├── image_processor.py
│   │   │   └── table_extractor.py
│   │   └── utils/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── UploadZone.tsx
│   │   │   ├── ImagePreview.tsx
│   │   │   ├── TableViewer.tsx
│   │   │   ├── SummaryEditor.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── pages/
│   │   │   ├── UploadPage.tsx
│   │   │   ├── OCRPage.tsx
│   │   │   ├── TablesPage.tsx
│   │   │   └── SummaryPage.tsx
│   │   ├── stores/
│   │   │   └── appStore.ts       # Zustand store
│   │   ├── utils/
│   │   │   └── api.ts            # API client
│   │   ├── types/
│   │   │   └── index.ts          # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

## Maryland-Specific Features

### Standards Alignment
The application includes prompts and templates aligned with:
- **Maryland College and Career Ready Standards (MCCRS)**
- **Next Generation Science Standards (NGSS)**
- **Maryland Social Studies Standards**

### Progress Report Structure
Generated reports include:
1. Current Performance Level
2. Strengths Demonstrated
3. Areas Needing Improvement
4. Specific Examples from Work
5. Next Steps for Instruction
6. Suggestions for Home Support
7. Behavioral and Social-Emotional Progress (optional)
8. IEP Goals Progress (optional)

### Supported Grade Levels
- Pre-K through 12
- All Maryland public school grade levels

## Mobile Features

- **Responsive Design**: Works on all screen sizes
- **Camera Access**: Direct photo capture from mobile devices
- **Touch Optimization**: Large touch targets and mobile-friendly UI
- **PWA Support**: Installable on mobile devices
- **Offline Capability**: Queue images for upload when offline

## Security Considerations

- **Data Privacy**: No student PII is stored permanently
- **Image Retention**: Uploaded images are automatically deleted after 24 hours
- **FERPA Compliance**: Designed with student privacy in mind
- **HTTPS**: Required for all connections in production

## Deployment

### Production Deployment

1. Build and push Docker images:
   ```bash
   docker-compose build
   docker-compose push
   ```

2. Deploy with Docker Compose:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

3. Configure reverse proxy (Nginx, Apache, etc.) to point to frontend:3000

### Kubernetes Deployment

See `k8s/` directory for Kubernetes manifests (not included in this template).

## Technologies Used

### Backend
- **FastAPI**: Python web framework
- **Pydantic**: Data validation and settings management
- **Pillow**: Image processing
- **OpenCV**: Advanced image processing
- **Tesseract OCR**: Fallback OCR engine
- **httpx**: Async HTTP client for Mistral API

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Chakra UI**: Component library
- **Zustand**: State management
- **React Dropzone**: File uploads
- **Vite**: Build tool and dev server
- **Vite PWA**: Progressive Web App support

### Infrastructure
- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration
- **Nginx**: Web server and reverse proxy
- **Redis**: Session storage (optional)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests (if available)
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues or questions, please open a GitHub issue.

## Acknowledgments

- Maryland State Department of Education (MSDE) for standards guidance
- Mistral AI for providing the OCR and LLM capabilities
- All open-source contributors whose libraries are used in this project
