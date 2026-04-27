import type { GenerateSummaryRequest, GenerateSummaryResponse, StructuredSummary } from '../types';

const STUDENT_PLACEHOLDER = '[STUDENT_NAME]';
const TEACHER_PLACEHOLDER = '[TEACHER_NAME]';
const SCHOOL_PLACEHOLDER = '[SCHOOL_NAME]';

export function anonymizeRequest(
  request: GenerateSummaryRequest
): { anonymized: GenerateSummaryRequest; mapping: Record<string, string> } {
  const mapping: Record<string, string> = {};
  const anonymized = { ...request };

  if (request.student_name) {
    mapping[STUDENT_PLACEHOLDER] = request.student_name;
    anonymized.student_name = STUDENT_PLACEHOLDER;
  }

  if (request.teacher_name) {
    mapping[TEACHER_PLACEHOLDER] = request.teacher_name;
    anonymized.teacher_name = TEACHER_PLACEHOLDER;
  }

  if (request.school) {
    mapping[SCHOOL_PLACEHOLDER] = request.school;
    anonymized.school = SCHOOL_PLACEHOLDER;
  }

  return { anonymized, mapping };
}

function replaceAll(text: string, mapping: Record<string, string>): string {
  let result = text;
  for (const [placeholder, realValue] of Object.entries(mapping)) {
    // Use split/join for global replacement without regex escaping concerns
    result = result.split(placeholder).join(realValue);
  }
  return result;
}

function deanonymizeStructuredData(
  data: StructuredSummary,
  mapping: Record<string, string>
): StructuredSummary {
  if (Object.keys(mapping).length === 0) {
    return data;
  }

  const replaceOptionalString = (val: string | undefined | null): string | undefined =>
    val != null ? replaceAll(val, mapping) : undefined;

  const replaceStringArray = (arr: string[] | undefined | null): string[] =>
    arr ? arr.map((item) => replaceAll(item, mapping)) : [];

  return {
    ...data,
    student_name: replaceOptionalString(data.student_name),
    grade_level: replaceOptionalString(data.grade_level),
    subject: replaceOptionalString(data.subject),
    reporting_period: replaceOptionalString(data.reporting_period),
    reading_level: replaceOptionalString(data.reading_level),
    math_level: replaceOptionalString(data.math_level),
    science_level: replaceOptionalString(data.science_level),
    social_studies_level: replaceOptionalString(data.social_studies_level),
    maryland_standards: data.maryland_standards
      ? replaceStringArray(data.maryland_standards)
      : undefined,
    strengths: replaceStringArray(data.strengths),
    areas_for_improvement: replaceStringArray(data.areas_for_improvement),
    next_steps: replaceStringArray(data.next_steps),
    home_support_suggestions: replaceStringArray(data.home_support_suggestions),
    work_habits: replaceOptionalString(data.work_habits),
    social_skills: replaceOptionalString(data.social_skills),
    behavior_observations: replaceOptionalString(data.behavior_observations),
    attendance_summary: replaceOptionalString(data.attendance_summary),
  };
}

export function deanonymizeResponse(
  response: GenerateSummaryResponse,
  mapping: Record<string, string>
): GenerateSummaryResponse {
  if (Object.keys(mapping).length === 0) {
    return response;
  }

  return {
    ...response,
    summary_text: response.summary_text ? replaceAll(response.summary_text, mapping) : '',
    structured_data: response.structured_data ? deanonymizeStructuredData(response.structured_data, mapping) : response.structured_data,
  };
}
