"""
FastAPI application for Quarterly Progress Report Notes
"""
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID, uuid4
import hashlib
import hmac
import logging
import os
import shutil

from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings
from .models.schemas import (
    ImageResponse,
    OCRRequest,
    OCRResultResponse,
    ExtractTablesRequest,
    ExtractTablesResponse,
    GenerateSummaryRequest,
    GenerateSummaryResponse,
    SessionResponse,
    SessionDetailResponse,
    HealthResponse,
    ErrorResponse
)
from .services.mistral_client import MistralClient
from .services.image_processor import ImageProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# --- PII Sanitization Helper (Layer 5) ---

def sanitize_log_message(message: str, pii_fields: list[str]) -> str:
    """Strip known PII values from a log message before writing."""
    sanitized = message
    for field in pii_fields:
        if field and field in sanitized:
            sanitized = sanitized.replace(field, "[REDACTED]")
    return sanitized


# --- Security Headers Middleware (Layer 7) ---

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' https://api.mistral.ai"
        )
        response.headers["Referrer-Policy"] = "no-referrer"

        # Cache-Control: no-store on /api/ routes
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"

        return response


# --- HMAC Session Token Helpers (Layer 6) ---

def _generate_session_token(session_id: str) -> str:
    """Generate an HMAC-based session token for the given session_id."""
    return hmac.new(
        settings.session_secret.encode(),
        session_id.encode(),
        hashlib.sha256,
    ).hexdigest()


def _validate_session_token(session_id: str, token: str) -> bool:
    """Validate an HMAC session token against the session_id."""
    expected = _generate_session_token(session_id)
    return hmac.compare_digest(expected, token)


def _resolve_session(request: Request, session_id_param: Optional[str] = None) -> Optional[str]:
    """Resolve session_id from headers (preferred) or query params (backward compat).

    Returns the validated session_id or None.
    Raises HTTPException if a token is provided but invalid, or if the session
    has expired.
    """
    # Prefer header-based session
    header_session_id = request.headers.get("X-Session-ID")
    header_session_token = request.headers.get("X-Session-Token")

    sid = header_session_id or session_id_param
    if not sid:
        return None

    # If a token was provided (header path), validate it
    if header_session_token:
        if not _validate_session_token(sid, header_session_token):
            raise HTTPException(status_code=403, detail="Invalid session token")

    # Check session exists and is not expired
    session = session_store.get_session(sid)
    if session is None:
        return None

    created_at: datetime = session["created_at"]
    expiry = timedelta(hours=settings.session_expiry_hours)
    if datetime.utcnow() - created_at > expiry:
        raise HTTPException(status_code=401, detail="Session has expired")

    return sid


# Lifespan management
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    
    # Ensure directories exist
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.temp_dir).mkdir(parents=True, exist_ok=True)
    
    # Clean up old files
    cleanup_old_files()
    
    yield
    
    # Shutdown
    logger.info("Shutting down application")
    cleanup_old_files()


def cleanup_old_files():
    """Clean up old uploaded files"""
    import time
    from datetime import timedelta
    
    upload_dir = Path(settings.upload_dir)
    temp_dir = Path(settings.temp_dir)
    retention_seconds = settings.image_retention_hours * 3600
    
    for directory in [upload_dir, temp_dir]:
        if directory.exists():
            for file_path in directory.glob("*"):
                if file_path.is_file():
                    file_age = time.time() - file_path.stat().st_mtime
                    if file_age > retention_seconds:
                        try:
                            file_path.unlink()
                            logger.debug(f"Cleaned up old file: {file_path}")
                        except Exception as e:
                            logger.error(f"Failed to clean up {file_path}: {str(e)}")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="API for Maryland Public School Quarterly Progress Report Notes",
    lifespan=lifespan
)

# Security headers middleware (Layer 7) — registered first so it wraps all responses
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-ID", "X-Session-Token"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")


# Dependency to get Mistral client
async def get_mistral_client():
    async with MistralClient() as client:
        yield client


# In-memory session storage (replace with Redis in production)
class SessionStore:
    def __init__(self):
        self.sessions: dict = {}
        self.images: dict = {}
        self.ocr_results: dict = {}
        self.summaries: dict = {}
    
    def create_session(self) -> str:
        session_id = str(uuid4())
        self.sessions[session_id] = {
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "image_count": 0,
            "ocr_count": 0,
            "summary_count": 0
        }
        return session_id
    
    def get_session(self, session_id: str) -> Optional[dict]:
        return self.sessions.get(session_id)
    
    def store_image(self, session_id: str, image_data: dict):
        if session_id not in self.images:
            self.images[session_id] = []
        self.images[session_id].append(image_data)
        if session_id in self.sessions:
            self.sessions[session_id]["image_count"] += 1
            self.sessions[session_id]["updated_at"] = datetime.utcnow()
    
    def store_ocr_result(self, session_id: str, result: dict):
        if session_id not in self.ocr_results:
            self.ocr_results[session_id] = []
        self.ocr_results[session_id].append(result)
        if session_id in self.sessions:
            self.sessions[session_id]["ocr_count"] += 1
            self.sessions[session_id]["updated_at"] = datetime.utcnow()
    
    def store_summary(self, session_id: str, summary: dict):
        if session_id not in self.summaries:
            self.summaries[session_id] = []
        self.summaries[session_id].append(summary)
        if session_id in self.sessions:
            self.sessions[session_id]["summary_count"] += 1
            self.sessions[session_id]["updated_at"] = datetime.utcnow()


session_store = SessionStore()


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            code=str(exc.status_code)
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="An unexpected error occurred. Please try again.",
        ).model_dump()
    )


# Health check endpoint
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        timestamp=datetime.utcnow(),
        services={
            "api": True,
            "mistral": bool(settings.mistral_api_key),
            "storage": True
        }
    )


# Session endpoints
@app.post("/api/sessions", response_model=SessionResponse)
async def create_session():
    """Create a new user session with HMAC token"""
    session_id = session_store.create_session()
    session = session_store.get_session(session_id)
    session_token = _generate_session_token(session_id)
    return SessionResponse(
        session_id=UUID(session_id),
        session_token=session_token,
        created_at=session["created_at"],
        updated_at=session["updated_at"]
    )


@app.get("/api/sessions", response_model=List[SessionResponse])
async def list_sessions():
    """List all active sessions"""
    sessions = []
    for session_id, session_data in session_store.sessions.items():
        sessions.append(SessionResponse(
            session_id=UUID(session_id),
            created_at=session_data["created_at"],
            updated_at=session_data["updated_at"],
            image_count=session_data["image_count"],
            ocr_count=session_data["ocr_count"],
            summary_count=session_data["summary_count"]
        ))
    return sessions


@app.get("/api/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(request: Request, session_id: str):
    """Get session details with all data"""
    # Validate session token if provided via header
    header_token = request.headers.get("X-Session-Token")
    if header_token and not _validate_session_token(session_id, header_token):
        raise HTTPException(status_code=403, detail="Invalid session token")

    session = session_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check expiry
    expiry = timedelta(hours=settings.session_expiry_hours)
    if datetime.utcnow() - session["created_at"] > expiry:
        raise HTTPException(status_code=401, detail="Session has expired")

    # Get all data for this session
    images = session_store.images.get(session_id, [])
    ocr_results = session_store.ocr_results.get(session_id, [])
    summaries = session_store.summaries.get(session_id, [])

    return SessionDetailResponse(
        session_id=UUID(session_id),
        created_at=session["created_at"],
        updated_at=session["updated_at"],
        image_count=session["image_count"],
        ocr_count=session["ocr_count"],
        summary_count=session["summary_count"],
        images=[ImageResponse(**img) for img in images],
        ocr_results=[OCRResultResponse(**ocr) for ocr in ocr_results],
        summaries=[GenerateSummaryResponse(**summ) for summ in summaries]
    )


# Image upload endpoint
@app.post("/api/upload", response_model=ImageResponse)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    session_id: Optional[str] = None
):
    """Upload an image for OCR processing"""
    # Resolve session from headers or query param
    resolved_session = _resolve_session(request, session_id)

    # Validate file type
    if file.content_type not in settings.allowed_image_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(settings.allowed_image_types)}"
        )

    # Validate file size
    file_size_mb = len(await file.read()) / (1024 * 1024)
    if file_size_mb > settings.max_image_size_mb:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max: {settings.max_image_size_mb}MB"
        )

    # Reset file pointer
    await file.seek(0)

    # Generate unique filename
    image_id = uuid4()
    file_ext = Path(file.filename).suffix
    filename = f"{image_id}{file_ext}"
    save_path = Path(settings.upload_dir) / filename

    # Save file
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Get image info
    width, height, format = ImageProcessor.get_image_info(save_path)

    # Create response
    image_response = ImageResponse(
        image_id=image_id,
        filename=file.filename,
        content_type=file.content_type,
        size_bytes=save_path.stat().st_size,
        uploaded_at=datetime.utcnow(),
        width=width,
        height=height
    )

    # Store in session if provided
    if resolved_session:
        session_store.store_image(resolved_session, image_response.model_dump())

    return image_response


# OCR endpoint
@app.post("/api/ocr", response_model=OCRResultResponse)
async def perform_ocr(
    request: OCRRequest,
    http_request: Request,
    session_id: Optional[str] = None,
    mistral_client: MistralClient = Depends(get_mistral_client)
):
    """Perform OCR on an uploaded image"""
    # Resolve session from headers or query param
    resolved_session = _resolve_session(http_request, session_id)

    # Find the image
    image_path = Path(settings.upload_dir) / f"{request.image_id}.jpg"
    if not image_path.exists():
        image_path = Path(settings.upload_dir) / f"{request.image_id}.png"
    if not image_path.exists():
        image_path = Path(settings.upload_dir) / f"{request.image_id}.jpeg"
    if not image_path.exists():
        image_path = Path(settings.upload_dir) / f"{request.image_id}.webp"

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    # Preprocess image if requested
    if request.enhance_image:
        processed_path = ImageProcessor.preprocess_for_ocr(image_path)
    else:
        processed_path = image_path

    try:
        # Use Mistral OCR if available and requested
        if request.use_mistral and settings.mistral_api_key:
            ocr_result = await mistral_client.perform_ocr(
                processed_path,
                language=request.language
            )
            model_used = settings.mistral_ocr_model
        else:
            # Fallback to Tesseract OCR
            ocr_result = await ImageProcessor._perform_tesseract_ocr(
                processed_path,
                language=request.language
            )
            model_used = "tesseract"

        # Set image_id in result
        ocr_result.image_id = request.image_id
        ocr_result.model_used = model_used
        ocr_result.completed_at = datetime.utcnow()

        # Store in session if provided
        if resolved_session:
            session_store.store_ocr_result(resolved_session, ocr_result.model_dump())

        # Clean up processed file if different from original
        if processed_path != image_path:
            processed_path.unlink()

        return ocr_result

    except Exception as e:
        # Clean up processed file if different from original
        if processed_path != image_path and processed_path.exists():
            processed_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )


# Table extraction endpoint
@app.post("/api/extract-tables", response_model=ExtractTablesResponse)
async def extract_tables(
    request: ExtractTablesRequest,
    http_request: Request,
    session_id: Optional[str] = None,
    mistral_client: MistralClient = Depends(get_mistral_client)
):
    """Extract tables from OCR text"""
    import hashlib as _hashlib
    import time as time_module

    # Resolve session from headers or query param
    resolved_session = _resolve_session(http_request, session_id)

    start_time = time_module.time()

    # Generate text hash for caching
    text_hash = _hashlib.md5(request.text.encode()).hexdigest()

    try:
        # Use Mistral for table extraction
        if settings.mistral_api_key:
            result = await mistral_client.extract_tables(request.text)
        else:
            # Fallback to simple table detection
            result = ImageProcessor._simple_table_extraction(request.text)

        tables = result.get("tables", [])

        # Filter by confidence if specified
        if request.min_confidence < 1.0:
            tables = [
                t for t in tables
                if t.get("confidence", 1.0) >= request.min_confidence
            ]

        processing_time = time_module.time() - start_time

        response = ExtractTablesResponse(
            text_hash=text_hash,
            tables=tables,
            processing_time=processing_time
        )

        # Store in session if provided
        if resolved_session:
            session_store.store_ocr_result(resolved_session, response.model_dump())

        return response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Table extraction failed: {str(e)}"
        )


# Summary generation endpoint
@app.post("/api/generate-summary", response_model=GenerateSummaryResponse)
async def generate_summary(
    request: GenerateSummaryRequest,
    http_request: Request,
    session_id: Optional[str] = None,
    mistral_client: MistralClient = Depends(get_mistral_client)
):
    """Generate a structured summary from OCR text"""
    # Resolve session from headers or query param
    resolved_session = _resolve_session(http_request, session_id)

    # Load original images for vision-augmented generation (IEP mode)
    image_paths: list[Path] = []
    if request.image_ids and request.report_type == "iep_progress_monitoring":
        for img_id in request.image_ids:
            # Find uploaded image file by UUID prefix
            upload_dir = Path(settings.upload_dir)
            matches = list(upload_dir.glob(f"{img_id}.*"))
            if matches:
                image_paths.append(matches[0])

    try:
        summary_response = await mistral_client.generate_summary(
            text=request.text,
            template=request.template,
            report_type=request.report_type,
            grade_level=request.grade_level,
            subject=request.subject,
            student_name=request.student_name,
            teacher_name=request.teacher_name,
            case_manager=request.case_manager,
            school=request.school,
            reporting_period=request.reporting_period,
            native_language=request.native_language,
            include_standards=request.include_standards,
            include_iep_goals=request.include_iep_goals,
            include_behavioral=request.include_behavioral,
            image_paths=image_paths if image_paths else None,
        )

        summary_response.completed_at = datetime.utcnow()

        # Store in session if provided
        if resolved_session:
            session_store.store_summary(resolved_session, summary_response.model_dump())

        return summary_response

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Summary generation failed: {str(e)}"
        )


# Add Tesseract OCR fallback to ImageProcessor
async def _perform_tesseract_ocr(image_path: Path, language: str = "eng"):
    """Fallback OCR using Tesseract"""
    import pytesseract
    import time as time_module
    
    start_time = time_module.time()
    
    try:
        # Open image with PIL and convert to RGB for Tesseract
        from PIL import Image as PILImage
        img = PILImage.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # Perform OCR directly on the RGB image
        text = pytesseract.image_to_string(
            img,
            lang=language,
            config="--psm 6"  # Assume a single uniform block of text
        )
        
        processing_time = time_module.time() - start_time
        
        from ..models.schemas import OCRResultResponse
        return OCRResultResponse(
            image_id=None,
            text=text,
            confidence=0.85,  # Estimated confidence for Tesseract
            processing_time=processing_time,
            model_used="tesseract"
        )
        
    except ImportError:
        raise Exception("Tesseract OCR is not installed. Please install pytesseract and tesseract-ocr.")
    except Exception as e:
        raise Exception(f"Tesseract OCR failed: {str(e)}")


# Add to ImageProcessor class
ImageProcessor._perform_tesseract_ocr = staticmethod(_perform_tesseract_ocr)


# Simple table extraction fallback
def _simple_table_extraction(text: str) -> dict:
    """Simple table extraction without Mistral"""
    import re
    
    # Look for table-like patterns (rows with | or tab-separated)
    tables = []
    
    # Pattern for pipe-delimited tables
    pipe_pattern = r'\|\s*([^\|]+)\s*\|'
    pipe_rows = re.findall(r'\|.*\|', text)
    
    if len(pipe_rows) > 1:
        # Try to parse as pipe-delimited table
        headers = [h.strip() for h in pipe_rows[0].split('|') if h.strip()]
        rows = []
        for row in pipe_rows[1:]:
            cells = [c.strip() for c in row.split('|') if c.strip()]
            if cells:
                rows.append(cells)
        
        if headers and rows:
            tables.append({
                "headers": headers,
                "rows": rows,
                "confidence": 0.7
            })
    
    # Pattern for tab/space separated tables
    # Look for lines with consistent spacing
    lines = text.split('\n')
    potential_tables = []
    current_table = []
    
    for line in lines:
        if not line.strip():
            if current_table:
                potential_tables.append(current_table)
                current_table = []
            continue
        
        # Check if line looks like a table row (multiple words with consistent spacing)
        words = line.split()
        if len(words) >= 3:
            current_table.append(words)
        else:
            if current_table:
                potential_tables.append(current_table)
                current_table = []
    
    if current_table:
        potential_tables.append(current_table)
    
    # Filter potential tables (at least 2 rows, consistent column count)
    for table in potential_tables:
        if len(table) >= 2:
            # Check if all rows have similar number of columns
            col_counts = [len(row) for row in table]
            if max(col_counts) - min(col_counts) <= 1:
                headers = table[0]
                rows = table[1:]
                tables.append({
                    "headers": headers,
                    "rows": rows,
                    "confidence": 0.6
                })
    
    return {"tables": tables}


ImageProcessor._simple_table_extraction = staticmethod(_simple_table_extraction)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
