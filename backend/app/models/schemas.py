"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4
from enum import Enum


class ImageStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    ERROR = "error"


class OCRStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


# Request Schemas

class UploadImageRequest(BaseModel):
    """Request schema for image upload"""
    pass  # Image data comes via multipart/form-data


class OCRRequest(BaseModel):
    """Request schema for OCR processing"""
    image_id: UUID
    language: str = "eng"
    enhance_image: bool = True
    use_mistral: bool = True  # Use Mistral OCR if available


class ExtractTablesRequest(BaseModel):
    """Request schema for table extraction"""
    text: str
    min_confidence: float = 0.7


class GenerateSummaryRequest(BaseModel):
    """Request schema for summary generation"""
    text: str
    template: str = "maryland_qpr"
    report_type: str = "general_ed"  # "general_ed" or "iep_progress_monitoring"
    grade_level: Optional[str] = None
    subject: Optional[str] = None
    student_name: Optional[str] = None
    teacher_name: Optional[str] = None
    case_manager: Optional[str] = None
    school: Optional[str] = None
    reporting_period: Optional[str] = None
    custom_prompt: Optional[str] = None
    image_ids: Optional[List[str]] = None  # Image UUIDs for vision-augmented generation

    # Maryland-specific options
    include_standards: bool = True
    include_iep_goals: bool = False
    include_behavioral: bool = True


# Response Schemas

class ImageResponse(BaseModel):
    """Response schema for image upload"""
    image_id: UUID
    filename: str
    content_type: str
    size_bytes: int
    status: ImageStatus = ImageStatus.UPLOADED
    uploaded_at: datetime
    width: Optional[int] = None
    height: Optional[int] = None
    
    class Config:
        from_attributes = True


class OCRResultResponse(BaseModel):
    """Response schema for OCR result"""
    image_id: Optional[UUID] = None
    text: str
    confidence: float
    processing_time: float
    status: OCRStatus = OCRStatus.COMPLETE
    model_used: str
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TableData(BaseModel):
    """Schema for extracted table"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    headers: List[str]
    rows: List[List[str]]
    confidence: float = 0.9
    bounding_box: Optional[Dict[str, Any]] = None


class ExtractTablesResponse(BaseModel):
    """Response schema for table extraction"""
    text_hash: Optional[str] = None
    tables: List[TableData]
    processing_time: float = 0.0


class StructuredSummary(BaseModel):
    """Schema for structured summary data"""
    student_name: Optional[str] = None
    grade_level: Optional[str] = None
    subject: Optional[str] = None
    reporting_period: Optional[str] = None
    
    # Academic progress
    reading_level: Optional[str] = None
    math_level: Optional[str] = None
    science_level: Optional[str] = None
    social_studies_level: Optional[str] = None
    
    # Standards alignment
    maryland_standards: Optional[List[str]] = None
    
    # Progress areas
    strengths: List[str] = Field(default_factory=list)
    areas_for_improvement: List[str] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    home_support_suggestions: List[str] = Field(default_factory=list)
    
    # Behavioral
    work_habits: Optional[str] = None
    social_skills: Optional[str] = None
    behavior_observations: Optional[str] = None
    
    # Attendance
    attendance_summary: Optional[str] = None


class GenerateSummaryResponse(BaseModel):
    """Response schema for summary generation"""
    summary_text: str
    structured_data: Optional[StructuredSummary] = None
    processing_time: float = 0.0
    model_used: str = ""
    completed_at: Optional[datetime] = None


class SessionResponse(BaseModel):
    """Response schema for session data"""
    session_id: UUID
    session_token: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    image_count: int = 0
    ocr_count: int = 0
    summary_count: int = 0

    class Config:
        from_attributes = True


class SessionDetailResponse(SessionResponse):
    """Detailed session response with all data"""
    images: List[ImageResponse] = Field(default_factory=list)
    ocr_results: List[OCRResultResponse] = Field(default_factory=list)
    summaries: List[GenerateSummaryResponse] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    """Standard error response schema"""
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = "healthy"
    version: str
    timestamp: datetime
    services: Dict[str, bool] = Field(default_factory=dict)
