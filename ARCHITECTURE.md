# Quarterly Progress Report Notes - Architecture

## Overview
A mobile-first web application for Maryland public school teachers to upload student work images, perform OCR, extract data tables, and generate structured quarterly progress report summaries using Mistral AI.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │  Upload     │  │  Image       │  │  Report Generation           │  │
│  │  Component  │──▶│  Preview     │──▶│  Component                   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
│        ▲                  ▲                    ▲                │
└────────┼──────────────────┼────────────────────┼────────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │  /upload    │  │  /ocr       │  │  /generate-summary           │  │
│  │  Endpoint   │──▶│  Endpoint   │──▶│  Endpoint                    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
│        │                  │                    │                │
└────────┼──────────────────┼────────────────────┼────────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                            │
│  ┌─────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  Image Storage       │  │  Mistral AI API                        │  │
│  │  (Local/Cloud)       │  │  - OCR Model                           │  │
│  │                      │  │  - LLM for Summary Generation         │  │
│  └─────────────────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **UI Library**: Material-UI (MUI) or Chakra UI (mobile-responsive)
- **State Management**: Zustand or React Context API
- **Image Handling**: react-dropzone for uploads, react-image-crop for editing
- **Mobile Optimization**: Responsive design with touch support

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **OCR**: Mistral AI OCR API + fallback to Tesseract OCR
- **LLM**: Mistral AI for structured summary generation
- **Image Processing**: Pillow (PIL) for image preprocessing
- **Table Extraction**: Custom logic + Mistral AI structured output

### Data Flow

1. **Image Upload**
   - User uploads image via mobile browser
   - Image stored temporarily (in-memory or local storage)
   - Preview generated for user confirmation

2. **OCR Processing**
   - Image sent to backend /ocr endpoint
   - Backend preprocesses image (resize, enhance contrast)
   - Mistral OCR API extracts text
   - Text returned to frontend

3. **Table Extraction**
   - OCR text analyzed for tabular data
   - Mistral AI identifies table structures
   - Tables presented for user verification

4. **Summary Generation**
   - User selects Maryland progress report template
   - Structured prompt generated based on template
   - Mistral AI generates summary from extracted data
   - User can edit and refine

## Maryland Public School Requirements

### Quarterly Progress Report Structure
Based on Maryland State Department of Education (MSDE) guidelines:

1. **Student Information**
   - Name, Grade, School, Teacher
   - Reporting Period

2. **Academic Progress**
   - Reading/Literacy
   - Mathematics
   - Science
   - Social Studies
   - Other Content Areas

3. **Skills and Standards**
   - Maryland College and Career Ready Standards alignment
   - IEP Goals (if applicable)
   - Progress toward goals

4. **Behavioral and Social-Emotional**
   - Work habits
   - Social skills
   - Behavior observations

5. **Attendance**
   - Days present/absent
   - Tardiness

6. **Teacher Comments**
   - Strengths
   - Areas for improvement
   - Next steps

7. **Parent/Guardian Communication**
   - Notes from conferences
   - Home communication

### Data Extraction Templates

The system will support extraction from:
- Handwritten notes
- Printed worksheets
- Assessment score sheets
- Attendance records
- Behavior tracking charts

## API Endpoints

### Backend (FastAPI)

```python
# Main endpoints
POST /api/upload          # Upload image, return image_id
POST /api/ocr/{image_id}   # Perform OCR on image
POST /api/extract-tables   # Extract tables from OCR text
POST /api/generate-summary # Generate summary from extracted data
GET  /api/sessions        # List user sessions (stateful)
GET  /api/sessions/{id}   # Get session data
```

### Request/Response Examples

**Upload Image:**
```json
POST /api/upload
Content-Type: multipart/form-data
{
  "image": <binary data>
}

Response:
{
  "image_id": "uuid",
  "filename": "student_work.jpg",
  "size": 1024,
  "uploaded_at": "2024-01-15T10:30:00Z"
}
```

**OCR Request:**
```json
POST /api/ocr/uuid
{
  "image_id": "uuid",
  "options": {
    "language": "eng",
    "enhance_image": true
  }
}

Response:
{
  "text": "Extracted text from image...",
  "confidence": 0.95,
  "processing_time": 1.2
}
```

**Generate Summary:**
```json
POST /api/generate-summary
{
  "text": "OCR extracted text",
  "template": "maryland_qpr",
  "grade_level": "3",
  "subject": "Reading",
  "custom_prompt": "Optional custom prompt"
}

Response:
{
  "summary": "Generated summary text...",
  "structured_data": {
    "student_name": "...",
    "grade": "...",
    "reading_level": "...",
    // ... other extracted fields
  }
}
```

## State Management

### Frontend State (Zustand Store)
```typescript
interface AppState {
  // Upload state
  images: ImageType[];
  currentImageId: string | null;
  
  // OCR state
  ocrResults: Record<string, OCRResult>;
  ocrLoading: boolean;
  
  // Table extraction
  extractedTables: TableType[];
  selectedTables: string[];
  
  // Summary generation
  summaries: SummaryType[];
  currentSummaryId: string | null;
  
  // Session management
  sessionId: string;
  sessions: SessionType[];
}
```

### Backend State (Session Storage)
Each user session stores:
- Uploaded images (temporary, cleaned up after 24h)
- OCR results
- Extracted tables
- Generated summaries
- User preferences

## File Structure

```
quarterly-progress-report/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app setup
│   │   ├── routes/
│   │   │   ├── upload.py
│   │   │   ├── ocr.py
│   │   │   ├── tables.py
│   │   │   └── summary.py
│   │   ├── services/
│   │   │   ├── mistral_client.py # Mistral AI integration
│   │   │   ├── image_processor.py
│   │   │   ├── table_extractor.py
│   │   │   └── prompt_builder.py
│   │   ├── models/
│   │   │   ├── schemas.py        # Pydantic models
│   │   │   └── database.py       # Session storage
│   │   └── config.py
│   ├── requirements.txt
│   └── Dockerfile
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
│   │   ├── hooks/
│   │   │   └── useMobile.ts
│   │   ├── utils/
│   │   │   ├── api.ts            # API client
│   │   │   └── constants.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

## Mistral AI Integration

### OCR Model
- Use Mistral's vision model for OCR
- Fallback to Tesseract for simple text
- Preprocessing: deskew, binarization, noise removal

### Prompt Engineering for Summary

**Base Prompt Template:**
```
You are an expert elementary school teacher in Maryland. 
Analyze the following student work data and generate a quarterly progress report.

Student: {student_name}
Grade: {grade_level}
Subject: {subject}
Date: {date}

Extracted Data:
{extracted_text}

Maryland Standards Alignment:
{standards}

Generate a progress report that includes:
1. Current performance level
2. Strengths demonstrated
3. Areas needing improvement
4. Specific examples from the work
5. Next steps for instruction
6. Suggestions for home support

Format as a professional teacher comment, 3-5 sentences per section.
```

**Table Extraction Prompt:**
```
Extract all tabular data from the following text. 
Identify column headers and row data. 
Return as JSON with format:
{
  "tables": [
    {
      "headers": ["Header 1", "Header 2"],
      "rows": [["cell1", "cell2"], ["cell3", "cell4"]]
    }
  ]
}

Text:
{ocr_text}
```

## Deployment

### Development
- Docker Compose for local development
- Hot reload for both frontend and backend
- Local Mistral API endpoint configuration

### Production
- Frontend: Static build served via Nginx
- Backend: FastAPI with Uvicorn/Gunicorn
- Storage: AWS S3 or local volume for images
- Database: Redis for session storage
- Scaling: Can be containerized and deployed to Kubernetes

### Mobile Considerations
- PWA (Progressive Web App) support
- Offline capability for image upload queue
- Touch-optimized UI
- Camera access for direct photo capture
- Responsive design for all screen sizes

## Security Considerations

1. **Authentication**: Optional teacher login (can start without for MVP)
2. **Data Privacy**: 
   - No student PII stored permanently
   - Images processed and deleted after session
   - FERPA compliance considerations
3. **Rate Limiting**: Prevent abuse of OCR API
4. **HTTPS**: Required for all connections

## Next Steps

1. Set up project structure
2. Implement backend OCR endpoint with Mistral integration
3. Create frontend upload and preview components
4. Build table extraction logic
5. Develop summary generation with Maryland-specific prompts
6. Test with sample Maryland progress report documents
7. Optimize for mobile use
