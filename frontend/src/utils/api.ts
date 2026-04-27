// API client for the backend service
import { 
  ImageType, 
  OCRResult, 
  ExtractTablesResponse, 
  GenerateSummaryResponse,
  SessionType,
  SessionDetailType,
  OCRRequest,
  ExtractTablesRequest,
  GenerateSummaryRequest
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Helper to handle API errors
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(
      errorData.detail || errorData.error || `HTTP ${response.status}: ${response.statusText}`
    );
    throw error;
  }
  return response.json();
}

// Session API
export const SessionAPI = {
  create: async (): Promise<SessionType> => {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<SessionType>(response);
  },
  
  list: async (): Promise<SessionType[]> => {
    const response = await fetch(`${API_BASE}/sessions`);
    return handleResponse<SessionType[]>(response);
  },
  
  get: async (sessionId: string): Promise<SessionDetailType> => {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
    return handleResponse<SessionDetailType>(response);
  },
};

// Image API
export const ImageAPI = {
  upload: async (
    file: File,
    sessionId?: string
  ): Promise<ImageType> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const url = sessionId 
      ? `${API_BASE}/upload?session_id=${sessionId}`
      : `${API_BASE}/upload`;
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<ImageType>(response);
  },
  
  getPreviewUrl: (_imageId: string): string => {
    // In production, you might have an endpoint to serve images
    // For now, we'll use a placeholder or the client-side preview
    return URL.createObjectURL(new Blob());
  },
};

// OCR API
export const OCRAPI = {
  process: async (
    request: OCRRequest,
    sessionId?: string
  ): Promise<OCRResult> => {
    const url = sessionId 
      ? `${API_BASE}/ocr?session_id=${sessionId}`
      : `${API_BASE}/ocr`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse<OCRResult>(response);
  },
};

// Table Extraction API
export const TableAPI = {
  extract: async (
    request: ExtractTablesRequest,
    sessionId?: string
  ): Promise<ExtractTablesResponse> => {
    const url = sessionId 
      ? `${API_BASE}/extract-tables?session_id=${sessionId}`
      : `${API_BASE}/extract-tables`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse<ExtractTablesResponse>(response);
  },
};

// Summary API
export const SummaryAPI = {
  generate: async (
    request: GenerateSummaryRequest,
    sessionId?: string
  ): Promise<GenerateSummaryResponse> => {
    const url = sessionId 
      ? `${API_BASE}/generate-summary?session_id=${sessionId}`
      : `${API_BASE}/generate-summary`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse<GenerateSummaryResponse>(response);
  },
};

// Health check
export const HealthAPI = {
  check: async (): Promise<any> => {
    const response = await fetch(`${API_BASE}/health`);
    return handleResponse<any>(response);
  },
};

// Combined API client
export const API = {
  session: SessionAPI,
  image: ImageAPI,
  ocr: OCRAPI,
  table: TableAPI,
  summary: SummaryAPI,
  health: HealthAPI,
};

export default API;
