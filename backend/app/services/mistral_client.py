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


def _sanitize_log_message(message: str, pii_fields: list[str]) -> str:
    """Strip known PII values from a log message before writing."""
    sanitized = message
    for field in pii_fields:
        if field and field in sanitized:
            sanitized = sanitized.replace(field, "[REDACTED]")
    return sanitized


class MistralClient:
    """Client for Mistral AI API"""
    
    def __init__(self, api_key: Optional[str] = None, api_url: Optional[str] = None):
        self.api_key = api_key or settings.mistral_api_key
        self.api_url = api_url or settings.mistral_api_url
        self.ocr_model = settings.mistral_ocr_model
        self.llm_model = settings.mistral_llm_model
        self._client = httpx.AsyncClient(timeout=120.0)
        # Tracks PII values for the current request so log messages can be sanitized
        self._pii_fields: list[str] = []
        
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
            sanitized_body = _sanitize_log_message(
                e.response.text, self._pii_fields
            )
            logger.error(
                f"Mistral API error: {e.response.status_code} - {sanitized_body}"
            )
            raise
        except Exception as e:
            sanitized_msg = _sanitize_log_message(str(e), self._pii_fields)
            logger.error(f"Mistral API request failed: {sanitized_msg}")
            raise
    
    async def perform_ocr(
        self,
        image_path: Path,
        language: str = "eng"
    ) -> OCRResultResponse:
        """Perform OCR using Mistral's dedicated OCR endpoint (/v1/ocr)"""
        import time as time_module

        start_time = time_module.time()

        with open(image_path, "rb") as f:
            image_data = f.read()

        image_b64 = base64.b64encode(image_data).decode("utf-8")

        suffix = image_path.suffix.lower().lstrip(".")
        if suffix == "pdf":
            document = {
                "type": "document_url",
                "document_url": f"data:application/pdf;base64,{image_b64}",
            }
        else:
            mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}.get(
                suffix, "image/png"
            )
            document = {
                "type": "image_url",
                "image_url": f"data:{mime};base64,{image_b64}",
            }

        payload = {
            "model": self.ocr_model,
            "document": document,
        }

        try:
            result = await self._make_request("POST", "ocr", payload)

            # OCR response has pages[].markdown
            pages = result.get("pages", [])
            text = "\n\n".join(page.get("markdown", "") for page in pages)

            processing_time = time_module.time() - start_time

            return OCRResultResponse(
                image_id=None,
                text=text,
                confidence=0.95,
                processing_time=processing_time,
                model_used=self.ocr_model
            )

        except Exception as e:
            sanitized_msg = _sanitize_log_message(str(e), self._pii_fields)
            logger.error(f"Mistral OCR failed: {sanitized_msg}")
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
            sanitized_msg = _sanitize_log_message(str(e), self._pii_fields)
            logger.error(f"Table extraction failed: {sanitized_msg}")
            return {"tables": []}
    
    async def generate_summary(
        self,
        text: str,
        template: str = "maryland_qpr",
        report_type: str = "general_ed",
        grade_level: Optional[str] = None,
        subject: Optional[str] = None,
        student_name: Optional[str] = None,
        teacher_name: Optional[str] = None,
        case_manager: Optional[str] = None,
        school: Optional[str] = None,
        reporting_period: Optional[str] = None,
        native_language: Optional[str] = None,
        include_standards: bool = True,
        include_iep_goals: bool = False,
        include_behavioral: bool = True,
    ) -> GenerateSummaryResponse:
        """
        Generate a structured summary from OCR-extracted text.

        Real names are sent to Mistral (protected by ZDR at the API level).
        """
        import time as time_module
        start_time = time_module.time()

        # Track PII for log sanitization
        self._pii_fields = [
            v for v in [student_name, teacher_name, case_manager, school] if v
        ]

        # Send real names to the LLM — ZDR protects PII at the API level
        if report_type == "iep_progress_monitoring":
            prompt = self._build_iep_prompt(
                text=text,
                grade_level=grade_level,
                subject=subject,
                student_name=student_name,
                case_manager=case_manager,
                school=school,
                reporting_period=reporting_period,
                include_behavioral=include_behavioral,
                native_language=native_language,
            )
        else:
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
                include_behavioral=include_behavioral,
            )

        payload = {
            "model": self.llm_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 8192,
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
            sanitized_msg = _sanitize_log_message(str(e), self._pii_fields)
            logger.error(f"Summary generation failed: {sanitized_msg}")
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
            "- Do NOT use any emojis, emoticons, or Unicode icons anywhere in the report",
            "- Use plain text section headers with numbering (e.g., '1. CURRENT PERFORMANCE LEVEL')",
            "",
            "Return the report as a single, well-formatted text block.",
        ])
        
        return "\n".join(prompt_parts)
    
    def _build_iep_prompt(
        self,
        text: str,
        grade_level: Optional[str],
        subject: Optional[str],
        student_name: Optional[str],
        case_manager: Optional[str],
        school: Optional[str],
        reporting_period: Optional[str],
        include_behavioral: bool,
        native_language: Optional[str] = None,
    ) -> str:
        """Build the IEP Progress Monitoring prompt matching Maryland State IEP format."""

        needs_spanish = native_language and native_language.lower() == "spanish"
        student = student_name or "the student"

        prompt_parts = [
            "You are a Maryland special education teacher writing IEP quarterly progress report entries.",
            "You generate ONLY the 'Description of Progress' field for the Maryland State IEP form (Section IV. Goals).",
            "",
        ]

        # Student info
        prompt_parts.append("Student Information:")
        if student_name:
            prompt_parts.append(f"- Student Name: {student_name}")
        if grade_level:
            prompt_parts.append(f"- Grade Level: {grade_level}")
        if subject:
            prompt_parts.append(f"- Goal Area: {subject}")
        if case_manager:
            prompt_parts.append(f"- Case Manager: {case_manager}")
        if school:
            prompt_parts.append(f"- School: {school}")
        if reporting_period:
            prompt_parts.append(f"- Reporting Period: {reporting_period}")
        if native_language:
            prompt_parts.append(f"- Native Language: {native_language}")

        prompt_parts.extend([
            "",
            "Extracted Data from Progress Monitoring Sheets:",
            "---",
            text,
            "---",
            "",
            "YOUR OUTPUT FORMAT",
            "",
            "For EACH goal found in the data, produce:",
            "1. A Progress Code (select exactly one)",
            "2. A Description of Progress (one sentence per objective)",
            "",
            "PROGRESS CODES (select exactly one per goal):",
            '- "Making sufficient progress to meet goal"',
            '- "Not making sufficient progress to meet the goal"',
            '- "Newly introduced skill: progress not measurable at this time"',
            '- "Not Yet Introduced"',
            '- "Achieved"',
            "",
            "Selection logic:",
            "- Most objectives at or trending toward criteria: Making sufficient progress",
            "- Most objectives significantly below criteria with no improvement: Not making sufficient progress",
            "- First reporting period, no data collected: Newly introduced skill",
            "- Goal not yet introduced to instruction: Not Yet Introduced",
            "- All criteria met consistently: Achieved",
            "",
            "DESCRIPTION OF PROGRESS FORMAT",
            "",
            "Write ONE sentence per objective using this pattern:",
            f'"Objective [N]: {student} [is able to / can] [skill] [with/in] [X]% accuracy [in X out of Y trials]."',
            "",
            "Rules:",
            "- ONE sentence per objective, maximum",
            "- ALWAYS include the accuracy percentage or frequency count from the data",
            "- ALWAYS reference the skill described in the objective",
            "- Use third person, present tense",
            f'- When an objective was not addressed: "Objective [N]: This objective has not been addressed this quarter."',
            f'- When an objective will be addressed later: "Objective [N]: This objective will be worked on this quarter."',
            "",
            "EXAMPLES OF CORRECT OUTPUT",
            "",
            "Example 1 - Reading Decoding:",
            "Progress Code: Making sufficient progress to meet goal",
            "Description of Progress: Objective 1: Keilan is able to read CVC words with digraphs with 100% accuracy. Objective 2: Keilan is able to read one syllable words with blends and short vowel sounds with 90% accuracy. Objective 3: Keilan is able to read 75% of Dolch Pre-Primer sight words.",
            "",
            "Example 2 - Learning Behaviors:",
            "Progress Code: Making sufficient progress to meet goal",
            "Description of Progress: Objective 1: This quarter Tristan began tasks within 2-3 minutes, given no more than 3 verbal prompts in 55% of opportunities. Objective 2: This quarter Tristan remained on task for at least 10 minutes given no more than 3 verbal prompts in 31% of opportunities. Objective 3: This quarter Tristan completed tasks within a given timeframe in 40% of opportunities.",
            "",
            "Example 3 - Written Expression:",
            "Progress Code: Making sufficient progress to meet goal",
            "Description of Progress: Objective 1: With small group instruction, prompting, lines drawn for each word, sentence frames, and the text to refer to, Randy is able to write a one sentence response to the question using evidence from the text. Objective 2: Randy recently completed a story map to organize his ideas before writing a book report.",
            "",
        ])

        if needs_spanish:
            prompt_parts.extend([
                "SPANISH TRANSLATION REQUIRED",
                "",
                f"Because {student}'s native language is Spanish, generate the Spanish translation immediately after the English text.",
                "Translate each objective individually.",
                "",
                "Translation rules:",
                '- "accuracy" = "precisión"',
                '- "[X]% accuracy" = "un [X] % de precisión" (space before %)',
                '- "This objective has not been addressed this quarter" = "Este objetivo no se ha abordado este trimestre"',
                "- Keep proper nouns (Dolch Pre-Primer, CVC) in English",
                "- Keep student names unchanged",
                "- Use formal Spanish register",
                "",
                "Example with Spanish:",
                "Description of Progress: Objective 1: Randy is able to read CVC words with 57% accuracy. Objective 2: This objective has not been addressed this quarter.",
                "",
                "Objetivo 1: Randy puede leer palabras CVC con un 57 % de precisión. Objetivo 2: Este objetivo no se ha abordado este trimestre.",
                "",
            ])

        prompt_parts.extend([
            "WHAT YOU MUST NEVER DO",
            "- Do NOT write multiple paragraphs or lengthy analysis",
            "- Do NOT include recommendations, strategies, next steps, or suggestions",
            "- Do NOT include encouragement or praise",
            "- Do NOT describe teaching methods or instructional approaches",
            "- Do NOT list session-by-session logs or specific trial dates",
            "- Do NOT analyze why the student is performing at a certain level",
            "- Do NOT compare the student to peers or grade-level expectations",
            "- Do NOT sign with credentials or include a provider name",
            "- Do NOT exceed 120 words per goal (English) or 240 words (English + Spanish)",
            "- Do NOT fabricate data -- only reference information found in the extracted text",
            "",
            "If multiple goal areas are present in the data, create separate sections for each.",
            "Format the output as markdown with ## headers for each goal area.",
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
