"""
Application configuration using Pydantic Settings
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os
import secrets


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Application
    app_name: str = "Quarterly Progress Report Notes"
    app_version: str = "0.1.0"
    debug: bool = Field(default=False, env="DEBUG")
    
    # Server
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    
    # Mistral AI
    mistral_api_key: str = Field(default="", env="MISTRAL_API_KEY")
    mistral_api_url: str = Field(
        default="https://api.mistral.ai/v1",
        env="MISTRAL_API_URL"
    )
    mistral_ocr_model: str = Field(
        default="mistral-ocr-latest",
        env="MISTRAL_OCR_MODEL"
    )
    mistral_llm_model: str = Field(
        default="mistral-large-latest",
        env="MISTRAL_LLM_MODEL"
    )
    
    # Image Processing
    max_image_size_mb: int = Field(default=10, env="MAX_IMAGE_SIZE_MB")
    allowed_image_types: list[str] = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    
    # Storage
    upload_dir: str = Field(default="./uploads", env="UPLOAD_DIR")
    temp_dir: str = Field(default="./temp", env="TEMP_DIR")
    image_retention_hours: int = Field(default=24, env="IMAGE_RETENTION_HOURS")
    
    # Redis for session storage
    redis_url: Optional[str] = Field(default=None, env="REDIS_URL")
    session_timeout: int = Field(default=3600, env="SESSION_TIMEOUT")  # 1 hour

    # Session security
    session_secret: str = Field(
        default_factory=lambda: secrets.token_hex(32),
        env="SESSION_SECRET"
    )
    session_expiry_hours: int = Field(default=2, env="SESSION_EXPIRY_HOURS")
    
    # Tesseract OCR (fallback)
    tesseract_path: Optional[str] = Field(default=None, env="TESSERACT_PATH")
    
    # CORS
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080"],
        env="CORS_ORIGINS"
    )
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Create settings instance
settings = Settings()

# Ensure directories exist
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.temp_dir, exist_ok=True)
