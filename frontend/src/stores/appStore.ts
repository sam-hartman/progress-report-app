"""
Zustand store for application state
"""
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AppState, MARYLAND_GRADES, MARYLAND_SUBJECTS, REPORTING_PERIODS } from '../types';

const initialState: AppState = {
  // Session
  sessionId: null,
  sessions: [],
  
  // Upload
  images: [],
  currentImageId: null,
  upload: {
    is_uploading: false,
    upload_progress: 0,
    error: null,
  },
  
  // OCR
  ocrResults: {},
  ocr: {
    is_processing: false,
    progress: 0,
    error: null,
  },
  
  // Tables
  extractedTables: [],
  selectedTableIds: [],
  
  // Summary
  summaries: [],
  currentSummaryId: null,
  summary: {
    is_generating: false,
    error: null,
  },
  
  // Form data
  formData: {
    student_name: '',
    grade_level: MARYLAND_GRADES[2], // Default to Grade 1
    subject: MARYLAND_SUBJECTS[0], // Default to Reading/Literacy
    teacher_name: '',
    school: '',
    reporting_period: REPORTING_PERIODS[0], // Default to Q1
    include_standards: true,
    include_iep_goals: false,
    include_behavioral: true,
  },
  
  // UI state
  currentStep: 'upload',
  is_mobile: false,
  has_camera_access: false,
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Actions
        setSessionId: (sessionId: string | null) => set({ sessionId }),
        
        addSession: (session: any) => set((state) => ({
          sessions: [...state.sessions, session],
        })),
        
        addImage: (image: any) => set((state) => ({
          images: [...state.images, image],
          currentImageId: image.image_id,
        })),
        
        setCurrentImageId: (imageId: string | null) => set({ currentImageId: imageId }),
        
        removeImage: (imageId: string) => set((state) => ({
          images: state.images.filter(img => img.image_id !== imageId),
          currentImageId: state.currentImageId === imageId ? null : state.currentImageId,
        })),
        
        setUploadState: (upload: Partial<AppState['upload']>) => set((state) => ({
          upload: { ...state.upload, ...upload },
        })),
        
        addOCRResult: (imageId: string, result: any) => set((state) => ({
          ocrResults: { ...state.ocrResults, [imageId]: result },
        })),
        
        setOCRState: (ocr: Partial<AppState['ocr']>) => set((state) => ({
          ocr: { ...state.ocr, ...ocr },
        })),
        
        setExtractedTables: (tables: any[]) => set({ extractedTables: tables }),
        
        setSelectedTableIds: (tableIds: string[]) => set({ selectedTableIds: tableIds }),
        
        toggleTableSelection: (tableId: string) => set((state) => {
          const selected = new Set(state.selectedTableIds);
          if (selected.has(tableId)) {
            selected.delete(tableId);
          } else {
            selected.add(tableId);
          }
          return { selectedTableIds: Array.from(selected) };
        }),
        
        addSummary: (summary: any) => set((state) => ({
          summaries: [...state.summaries, summary],
          currentSummaryId: summary.summary_id || summary.completed_at,
        })),
        
        setCurrentSummaryId: (summaryId: string | null) => set({ currentSummaryId: summaryId }),
        
        setSummaryState: (summary: Partial<AppState['summary']>) => set((state) => ({
          summary: { ...state.summary, ...summary },
        })),
        
        updateFormData: (updates: Partial<AppState['formData']>) => set((state) => ({
          formData: { ...state.formData, ...updates },
        })),
        
        setCurrentStep: (step: AppState['currentStep']) => set({ currentStep: step }),
        
        setIsMobile: (isMobile: boolean) => set({ is_mobile: isMobile }),
        
        setHasCameraAccess: (hasAccess: boolean) => set({ has_camera_access: hasAccess }),
        
        // Reset actions
        resetUpload: () => set({
          upload: initialState.upload,
          images: initialState.images,
          currentImageId: initialState.currentImageId,
        }),
        
        resetOCR: () => set({
          ocr: initialState.ocr,
          ocrResults: initialState.ocrResults,
          extractedTables: initialState.extractedTables,
          selectedTableIds: initialState.selectedTableIds,
        }),
        
        resetSummary: () => set({
          summary: initialState.summary,
          summaries: initialState.summaries,
          currentSummaryId: initialState.currentSummaryId,
        }),
        
        resetAll: () => set(initialState),
        
        // Navigation helpers
        goToUpload: () => set({ currentStep: 'upload' }),
        goToOCR: () => set({ currentStep: 'ocr' }),
        goToTables: () => set({ currentStep: 'tables' }),
        goToSummary: () => set({ currentStep: 'summary' }),
      }),
      {
        name: 'qpr-app-storage',
        partialize: (state) => ({
          // Only persist these parts of state
          formData: state.formData,
          currentStep: state.currentStep,
        }),
      }
    ),
    { name: 'AppStore' }
  )
);

// Selectors for better performance
export const useSession = () => useAppStore((state) => ({
  sessionId: state.sessionId,
  sessions: state.sessions,
  setSessionId: state.setSessionId,
  addSession: state.addSession,
}));

export const useImages = () => useAppStore((state) => ({
  images: state.images,
  currentImageId: state.currentImageId,
  addImage: state.addImage,
  setCurrentImageId: state.setCurrentImageId,
  removeImage: state.removeImage,
}));

export const useUpload = () => useAppStore((state) => ({
  upload: state.upload,
  setUploadState: state.setUploadState,
  resetUpload: state.resetUpload,
}));

export const useOCR = () => useAppStore((state) => ({
  ocr: state.ocr,
  ocrResults: state.ocrResults,
  addOCRResult: state.addOCRResult,
  setOCRState: state.setOCRState,
  resetOCR: state.resetOCR,
}));

export const useTables = () => useAppStore((state) => ({
  extractedTables: state.extractedTables,
  selectedTableIds: state.selectedTableIds,
  setExtractedTables: state.setExtractedTables,
  setSelectedTableIds: state.setSelectedTableIds,
  toggleTableSelection: state.toggleTableSelection,
}));

export const useSummary = () => useAppStore((state) => ({
  summary: state.summary,
  summaries: state.summaries,
  currentSummaryId: state.currentSummaryId,
  addSummary: state.addSummary,
  setCurrentSummaryId: state.setCurrentSummaryId,
  setSummaryState: state.setSummaryState,
  resetSummary: state.resetSummary,
}));

export const useFormData = () => useAppStore((state) => ({
  formData: state.formData,
  updateFormData: state.updateFormData,
}));

export const useNavigation = () => useAppStore((state) => ({
  currentStep: state.currentStep,
  setCurrentStep: state.setCurrentStep,
  goToUpload: state.goToUpload,
  goToOCR: state.goToOCR,
  goToTables: state.goToTables,
  goToSummary: state.goToSummary,
}));

export const useUIState = () => useAppStore((state) => ({
  is_mobile: state.is_mobile,
  has_camera_access: state.has_camera_access,
  setIsMobile: state.setIsMobile,
  setHasCameraAccess: state.setHasCameraAccess,
}));

export default useAppStore;
