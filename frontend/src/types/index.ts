// Image types
export interface ImageType {
  image_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  uploaded_at: string;
  width?: number;
  height?: number;
  preview_url?: string;
}

// OCR types
export interface OCRResult {
  image_id: string;
  text: string;
  confidence: number;
  processing_time: number;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  model_used: string;
  completed_at: string;
}

// Table types
export interface TableData {
  id: string;
  headers: string[];
  rows: string[][];
  confidence: number;
  bounding_box?: any;
}

export interface ExtractTablesResponse {
  text_hash: string;
  tables: TableData[];
  processing_time: number;
}

// Summary types
export interface StructuredSummary {
  student_name?: string;
  grade_level?: string;
  subject?: string;
  reporting_period?: string;
  
  // Academic progress
  reading_level?: string;
  math_level?: string;
  science_level?: string;
  social_studies_level?: string;
  
  // Standards alignment
  maryland_standards?: string[];
  
  // Progress areas
  strengths: string[];
  areas_for_improvement: string[];
  next_steps: string[];
  home_support_suggestions: string[];
  
  // Behavioral
  work_habits?: string;
  social_skills?: string;
  behavior_observations?: string;
  
  // Attendance
  attendance_summary?: string;
}

export interface GenerateSummaryResponse {
  summary_text: string;
  structured_data: StructuredSummary;
  processing_time: number;
  model_used: string;
  completed_at: string;
}

// Session types
export interface SessionType {
  session_id: string;
  created_at: string;
  updated_at: string;
  image_count: number;
  ocr_count: number;
  summary_count: number;
}

export interface SessionDetailType extends SessionType {
  images: ImageType[];
  ocr_results: OCRResult[];
  summaries: GenerateSummaryResponse[];
}

// API Request types
export interface OCRRequest {
  image_id: string;
  language?: string;
  enhance_image?: boolean;
  use_mistral?: boolean;
}

export interface ExtractTablesRequest {
  text: string;
  min_confidence?: number;
}

export interface GenerateSummaryRequest {
  text: string;
  template?: string;
  report_type?: ReportType;
  grade_level?: string;
  subject?: string;
  student_name?: string;
  teacher_name?: string;
  case_manager?: string;
  school?: string;
  reporting_period?: string;
  custom_prompt?: string;
  include_standards?: boolean;
  include_iep_goals?: boolean;
  include_behavioral?: boolean;
}

// UI State types
export interface UploadState {
  is_uploading: boolean;
  upload_progress: number;
  error: string | null;
}

export interface OCRState {
  is_processing: boolean;
  progress: number;
  error: string | null;
}

export interface SummaryState {
  is_generating: boolean;
  error: string | null;
}

// App State
export interface AppState {
  // Session
  sessionId: string | null;
  sessions: SessionType[];

  // Upload
  images: ImageType[];
  currentImageId: string | null;
  upload: UploadState;

  // OCR
  ocrResults: Record<string, OCRResult>;
  ocr: OCRState;

  // Tables
  extractedTables: TableData[];
  selectedTableIds: string[];

  // Summary
  summaries: GenerateSummaryResponse[];
  currentSummaryId: string | null;
  summary: SummaryState;

  // Form data for summary generation
  formData: {
    report_type: ReportType;
    student_name: string;
    grade_level: string;
    subject: string;
    case_manager: string;
    teacher_name: string;
    school: string;
    reporting_period: string;
    include_standards: boolean;
    include_iep_goals: boolean;
    include_behavioral: boolean;
  };

  // Report history
  reportHistory: ReportRecord[];

  // Privacy & compliance
  privacyConsent: PrivacyConsent | null;

  // Session timeout
  lastActivityAt: number;

  // UI state
  currentStep: 'upload' | 'ocr' | 'tables' | 'summary';
  is_mobile: boolean;
  has_camera_access: boolean;

  // Actions
  setSessionId: (sessionId: string | null) => void;
  addSession: (session: SessionType) => void;
  createSession?: () => void;
  addImage: (image: ImageType & { preview_url?: string }) => void;
  setCurrentImageId: (imageId: string | null) => void;
  removeImage: (imageId: string) => void;
  setUploadState: (upload: Partial<UploadState>) => void;
  resetUpload: () => void;
  addOCRResult: (imageId: string, result: OCRResult) => void;
  setOCRState: (ocr: Partial<OCRState>) => void;
  resetOCR: () => void;
  setExtractedTables: (tables: TableData[]) => void;
  setSelectedTableIds: (tableIds: string[]) => void;
  toggleTableSelection: (tableId: string) => void;
  addSummary: (summary: GenerateSummaryResponse) => void;
  setCurrentSummaryId: (summaryId: string | null) => void;
  setSummaryState: (summary: Partial<SummaryState>) => void;
  resetSummary: () => void;
  updateFormData: (updates: Partial<AppState['formData']>) => void;
  setCurrentStep: (step: AppState['currentStep']) => void;
  goToUpload: () => void;
  goToOCR: () => void;
  goToTables: () => void;
  goToSummary: () => void;
  setIsMobile: (isMobile: boolean) => void;
  setHasCameraAccess: (hasAccess: boolean) => void;
  addReportToHistory: (report: ReportRecord) => void;
  removeReportFromHistory: (reportId: string) => void;
  clearHistory: () => void;
  setPrivacyConsent: (consent: PrivacyConsent | null) => void;
  updateActivity: () => void;
  resetAll: () => void;
}

// Report history
export interface ReportRecord {
  id: string;
  createdAt: string;
  formData: AppState['formData'];
  summaryText: string;
  ocrTexts: { filename: string; text: string }[];
  imageFilenames: string[];
  modelUsed: string;
  processingTime: number;
}

// Privacy & Compliance types
export interface PrivacyConsent {
  consentedAt: string;
  version: string;  // e.g. "1.0"
}

export interface AuditLogEntry {
  timestamp: string;
  event: string;  // e.g. 'CONSENT_GIVEN', 'IMAGE_UPLOADED', 'REPORT_GENERATED', 'DATA_CLEARED'
  details?: string;  // No PII - just IDs
}

// Maryland-specific types
export interface MarylandStandards {
  subject: string;
  grade: string;
  standards: string[];
}

export const MARYLAND_GRADES = [
  'Pre-K', 'Kindergarten', '1', '2', '3', '4', '5', 
  '6', '7', '8', '9', '10', '11', '12'
];

export const MARYLAND_SUBJECTS = [
  'Reading/Literacy',
  'Mathematics',
  'Science',
  'Social Studies',
  'Writing',
  'Speaking & Listening',
  'Language',
  'All Subjects',
];

// IEP Progress Monitoring types
export type ReportType = 'general_ed' | 'iep_progress_monitoring';

export const IEP_GOAL_AREAS = [
  'Reading Decoding',
  'Reading Comprehension',
  'Written Language',
  'Math Calculation',
  'Math Problem Solving',
  'Learning Behavior',
  'Speech/Language',
  'Social/Emotional',
  'Fine Motor',
  'Gross Motor',
  'Adaptive Behavior',
  'Other',
] as const;

export type IEPGoalArea = (typeof IEP_GOAL_AREAS)[number];

export const REPORTING_PERIODS = [
  'Q1 - First Quarter',
  'Q2 - Second Quarter', 
  'Q3 - Third Quarter',
  'Q4 - Fourth Quarter',
  'Mid-Year',
  'End of Year'
];
