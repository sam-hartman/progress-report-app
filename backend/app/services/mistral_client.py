"""
Mistral AI API client for OCR and LLM operations
"""
import httpx
import json
import time
from typing import Optional, Dict, Any, List
from pathlib import Path
import base64
import logging

from ..config import settings
from ..models.schemas import OCRResultResponse, GenerateSummaryResponse, StructuredSummary

logger = logging.getLogger(__name__)


class MistralClient:
    """Client for Mistral AI API"""
    
    def __init__(self, api_key: Optional[str] = None, api_url: Optional[str] = None):
        self.api_key = api_key or settings.mistral_api_key
        self.api_url = api_url or settings.mistral_api_url
        self.ocr_model = settings.mistral_ocr_model
        self.llm_model = settings.mistral_llm_model
        self._client = httpx.AsyncClient(timeout=120.0)
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._client.aclose()
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        payload: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make a request to Mistral API"""
        if not self.api_key:
            raise ValueError("Mistral API key is required")
            
        url = f"{self.api_url}/{endpoint}"
        default_headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        if headers:
            default_headers.update(headers)
        
        try:
            start_time = time.time()
            
            if files:
                # Multipart form data
                response = await self._client.post(
                    url,
                    files=files,
                    data=payload,
                    headers={k: v for k, v in default_headers.items() if k != "Content-Type"}
                )
            else:
                # JSON payload
                response = await self._client.request(
                    method,
                    url,
                    json=payload,
                    headers=default_headers
                )
            
            response.raise_for_status()
            result = response.json()
            
            logger.debug(f"Mistral API {method} {endpoint} - {time.time() - start_time:.2f}s")
            return result
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Mistral API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Mistral API request failed: {str(e)}")
            raise
    
    async def perform_ocr(
        self,
        image_path: Path,
        language: str = "eng"
    ) -> OCRResultResponse:
        """
        Perform OCR on an image using Mistral's vision model
        
        Note: As of current Mistral API, OCR might need to be done via
        the chat completion endpoint with image support
        """
        import time as time_module
        
        start_time = time_module.time()
        
        # Read image and encode as base64
        with open(image_path, "rb") as f:
            image_data = f.read()
        
        image_b64 = base64.b64encode(image_data).decode("utf-8")
        
        # Mistral OCR prompt
        ocr_prompt = """Extract all text from this image exactly as it appears. 
Preserve formatting, line breaks, and spacing. 
Return only the extracted text without any additional commentary."""
        
        payload = {
            "model": "pixtral-large-latest",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": ocr_prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}}
                    ]
                }
            ],
            "max_tokens": 4096,
            "temperature": 0.0
        }
        
        try:
            result = await self._make_request("POST", "chat/completions", payload)
            
            # Extract text from response
            text = result["choices"][0]["message"]["content"]
            
            # Calculate confidence (Mistral doesn't provide this directly)
            # We'll use a placeholder or estimate based on response
            confidence = 0.95  # Placeholder - Mistral vision is generally high confidence
            
            processing_time = time_module.time() - start_time
            
            return OCRResultResponse(
                image_id=None,  # Will be set by caller
                text=text,
                confidence=confidence,
                processing_time=processing_time,
                model_used=self.ocr_model
            )
            
        except Exception as e:
            logger.error(f"Mistral OCR failed: {str(e)}")
            raise
    
    async def extract_tables(
        self,
        text: str
    ) -> List[Dict[str, Any]]:
        """
        Extract tables from text using Mistral LLM
        """
        table_extraction_prompt = f"""Extract all tabular data from the following text. 
Identify column headers and row data. 
Return ONLY a valid JSON object with the following format:

{{
  "tables": [
    {{
      "headers": ["Header 1", "Header 2", ...],
      "rows": [
        ["cell1", "cell2", ...],
        ["cell3", "cell4", ...]
      ]
    }}
  ]
}}

If no tables are found, return {{"tables": []}}.

Text to analyze:
{text}"""
        
        payload = {
            "model": self.llm_model,
            "messages": [
                {
                    "role": "user",
                    "content": table_extraction_prompt
                }
            ],
            "max_tokens": 2048,
            "temperature": 0.0
        }
        
        try:
            result = await self._make_request("POST", "chat/completions", payload)
            content = result["choices"][0]["message"]["content"]
            
            # Parse JSON from response
            # Try to extract JSON from the response
            try:
                # Find the JSON in the response
                json_start = content.find("{")
                json_end = content.rfind("}") + 1
                json_str = content[json_start:json_end]
                return json.loads(json_str)
            except json.JSONDecodeError:
                # If parsing fails, return empty
                logger.warning("Failed to parse table extraction JSON")
                return {"tables": []}
                
        except Exception as e:
            logger.error(f"Table extraction failed: {str(e)}")
            return {"tables": []}
    
    async def generate_summary(
        self,
        text: str,
        template: str = "maryland_qpr",
        grade_level: Optional[str] = None,
        subject: Optional[str] = None,
        student_name: Optional[str] = None,
        teacher_name: Optional[str] = None,
        school: Optional[str] = None,
        reporting_period: Optional[str] = None,
        include_standards: bool = True,
        include_iep_goals: bool = False,
        include_behavioral: bool = True
    ) -> GenerateSummaryResponse:
        """
        Generate a structured summary from extracted text
        """
        import time as time_module
        start_time = time_module.time()
        
        # Build the prompt based on template
        prompt = self._build_summary_prompt(
            text=text,
            template=template,
            grade_level=grade_level,
            subject=subject,
            student_name=student_name,
            teacher_name=teacher_name,
            school=school,
            reporting_period=reporting_period,
            include_standards=include_standards,
            include_iep_goals=include_iep_goals,
            include_behavioral=include_behavioral
        )
        
        payload = {
            "model": self.llm_model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 4096,
            "temperature": 0.3
        }
        
        try:
            result = await self._make_request("POST", "chat/completions", payload)
            summary_text = result["choices"][0]["message"]["content"]
            
            # Parse structured data from the response
            structured_data = self._parse_summary_response(summary_text)
            
            processing_time = time_module.time() - start_time
            
            return GenerateSummaryResponse(
                summary_text=summary_text,
                structured_data=structured_data,
                processing_time=processing_time,
                model_used=self.llm_model
            )
            
        except Exception as e:
            logger.error(f"Summary generation failed: {str(e)}")
            raise
    
    def _build_summary_prompt(
        self,
        text: str,
        template: str,
        grade_level: Optional[str],
        subject: Optional[str],
        student_name: Optional[str],
        teacher_name: Optional[str],
        school: Optional[str],
        reporting_period: Optional[str],
        include_standards: bool,
        include_iep_goals: bool,
        include_behavioral: bool
    ) -> str:
        """Build the summary generation prompt"""
        
        # Maryland-specific standards
        maryland_standards_info = """
Maryland College and Career Ready Standards (MCCRS) alignment:
- English Language Arts: Reading Literature, Reading Informational Text, Writing, Speaking & Listening, Language
- Mathematics: Operations & Algebraic Thinking, Number & Operations in Base Ten, Measurement & Data, Geometry
- Science: Next Generation Science Standards (NGSS) - Physical Science, Life Science, Earth & Space Science, Engineering
- Social Studies: Maryland Social Studies Standards - History, Geography, Economics, Civics & Government
"""
        
        # Base prompt for Maryland Quarterly Progress Report
        prompt_parts = [
            "You are an expert elementary school teacher in Maryland.",
            "Analyze the following student work data and generate a comprehensive quarterly progress report.",
            "",
            "Student Information:",
        ]
        
        if student_name:
            prompt_parts.append(f"- Student Name: {student_name}")
        if grade_level:
            prompt_parts.append(f"- Grade Level: {grade_level}")
        if subject:
            prompt_parts.append(f"- Subject: {subject}")
        if teacher_name:
            prompt_parts.append(f"- Teacher: {teacher_name}")
        if school:
            prompt_parts.append(f"- School: {school}")
        if reporting_period:
            prompt_parts.append(f"- Reporting Period: {reporting_period}")
        
        prompt_parts.extend([
            "",
            "Extracted Data from Student Work:",
            "---",
            text,
            "---",
            "",
        ])
        
        if include_standards:
            prompt_parts.append(maryland_standards_info)
        
        prompt_parts.extend([
            "",
            "Generate a professional quarterly progress report that includes the following sections:",
            "",
            "1. CURRENT PERFORMANCE LEVEL",
            "   - Overall academic performance in the subject area",
            "   - Specific skill levels (e.g., reading level, math level)",
            "",
            "2. STRENGTHS DEMONSTRATED",
            "   - 3-5 specific strengths shown in the work",
            "   - Reference specific skills or concepts mastered",
            "",
            "3. AREAS NEEDING IMPROVEMENT",
            "   - 2-3 areas where the student needs growth",
            "   - Be specific about what needs improvement",
            "",
            "4. SPECIFIC EXAMPLES FROM THE WORK",
            "   - Reference specific problems, answers, or work shown in the extracted data",
            "   - Quote or describe actual student work",
            "",
            "5. NEXT STEPS FOR INSTRUCTION",
            "   - What the teacher will do to support the student",
            "   - Specific strategies or interventions",
            "",
            "6. SUGGESTIONS FOR HOME SUPPORT",
            "   - What parents/guardians can do to support learning at home",
            "   - Specific, actionable suggestions",
        ])
        
        if include_behavioral:
            prompt_parts.extend([
                "",
                "7. BEHAVIORAL AND SOCIAL-EMOTIONAL PROGRESS",
                "   - Work habits (e.g., completes work on time, stays on task)",
                "   - Social skills and collaboration",
                "   - Behavior observations",
            ])
        
        if include_iep_goals:
            prompt_parts.extend([
                "",
                "8. IEP GOALS PROGRESS (if applicable)",
                "   - Progress toward Individualized Education Program goals",
                "   - Specific goal achievements or areas needing support",
            ])
        
        prompt_parts.extend([
            "",
            "Formatting Requirements:",
            "- Write in a professional, supportive, and constructive tone",
            "- Use complete sentences and proper grammar",
            "- Each section should be 2-4 sentences",
            "- Use bullet points for lists within sections",
            "- Include specific, concrete examples",
            "- Be honest but encouraging",
            "- Total report should be approximately 150-300 words",
            "",
            "Return the report as a single, well-formatted text block.",
        ])
        
        return "\n".join(prompt_parts)
    
    def _parse_summary_response(self, text: str) -> StructuredSummary:
        """
        Parse the summary response to extract structured data
        This is a best-effort extraction since the LLM returns natural language
        """
        # This is a simplified parser - in production, you might want
        # the LLM to return structured JSON
        structured = StructuredSummary()
        
        # Try to extract key information from the text
        # This is a placeholder - you'd want to improve this
        # or have the LLM return structured JSON directly
        
        return structured
