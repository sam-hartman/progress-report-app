"""
Image preprocessing and processing utilities
"""
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image, ImageEnhance, ImageFilter
import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


class ImageProcessor:
    """Image preprocessing for OCR optimization"""
    
    @staticmethod
    def validate_image(image_path: Path, max_size_mb: int = 10) -> bool:
        """Validate image file"""
        if not image_path.exists():
            return False
            
        # Check file size
        file_size_mb = image_path.stat().st_size / (1024 * 1024)
        if file_size_mb > max_size_mb:
            logger.warning(f"Image too large: {file_size_mb:.2f}MB > {max_size_mb}MB")
            return False
            
        # Check if it's a valid image
        try:
            with Image.open(image_path) as img:
                img.verify()
            return True
        except Exception as e:
            logger.error(f"Invalid image file: {str(e)}")
            return False
    
    @staticmethod
    def get_image_info(image_path: Path) -> Tuple[int, int, str]:
        """Get image dimensions and format"""
        with Image.open(image_path) as img:
            return img.width, img.height, img.format
    
    @staticmethod
    def preprocess_for_ocr(
        image_path: Path,
        output_path: Optional[Path] = None,
        target_width: int = 2048,
        enhance_contrast: bool = True,
        remove_noise: bool = True,
        deskew: bool = True
    ) -> Path:
        """
        Preprocess image for optimal OCR results
        
        Args:
            image_path: Path to input image
            output_path: Path to save processed image (optional)
            target_width: Target width for resizing (maintains aspect ratio)
            enhance_contrast: Whether to enhance contrast
            remove_noise: Whether to remove noise
            deskew: Whether to deskew the image
            
        Returns:
            Path to the processed image
        """
        with Image.open(image_path) as img:
            # Convert to RGB if needed
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Resize if too large
            if img.width > target_width:
                ratio = target_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)
            
            # Convert to numpy array for OpenCV processing
            img_array = np.array(img)
            
            # Convert to grayscale
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            
            # Enhance contrast
            if enhance_contrast:
                gray = cv2.equalizeHist(gray)
            
            # Remove noise
            if remove_noise:
                gray = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)
            
            # Deskew
            if deskew:
                gray = ImageProcessor._deskew(gray)
            
            # Binarization (thresholding)
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Convert back to PIL Image
            processed_img = Image.fromarray(binary)
            
            # Save to output path or temporary file
            if output_path is None:
                output_path = image_path.parent / f"processed_{image_path.name}"
            
            processed_img.save(output_path, format='PNG')
            
            return output_path
    
    @staticmethod
    def _deskew(image: np.ndarray, angle_range: Tuple[float, float] = (-15, 15)) -> np.ndarray:
        """
        Deskew an image using OpenCV
        
        Args:
            image: Grayscale image as numpy array
            angle_range: Range of angles to check for skew
            
        Returns:
            Deskewed image
        """
        # Find all non-zero points
        coords = np.column_stack(np.where(image > 0))
        
        if len(coords) == 0:
            return image
        
        # Compute the minimum area rectangle
        rect = cv2.minAreaRect(coords)
        angle = rect[-1]
        
        # Adjust angle to be within the specified range
        if angle < angle_range[0]:
            angle += 90
        elif angle > angle_range[1]:
            angle -= 90
        
        # Rotate the image to deskew
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        return rotated
    
    @staticmethod
    def enhance_readability(image_path: Path, output_path: Optional[Path] = None) -> Path:
        """
        Enhance image for better readability
        
        Args:
            image_path: Path to input image
            output_path: Path to save enhanced image
            
        Returns:
            Path to the enhanced image
        """
        with Image.open(image_path) as img:
            # Convert to RGB
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Enhance sharpness
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(2.0)
            
            # Enhance contrast
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.5)
            
            # Enhance brightness
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(1.1)
            
            # Save
            if output_path is None:
                output_path = image_path.parent / f"enhanced_{image_path.name}"
            
            img.save(output_path)
            return output_path
    
    @staticmethod
    def create_thumbnail(image_path: Path, size: Tuple[int, int] = (300, 300)) -> Path:
        """Create a thumbnail of the image"""
        with Image.open(image_path) as img:
            img.thumbnail(size, Image.Resampling.LANCZOS)
            thumbnail_path = image_path.parent / f"thumb_{image_path.name}"
            img.save(thumbnail_path)
            return thumbnail_path
