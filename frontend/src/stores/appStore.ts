// Zustand store for application state
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { AppState, ImageType, OCRResult, SessionType, TableData, GenerateSummaryResponse, ReportRecord, PrivacyConsent, MARYLAND_GRADES, MARYLAND_SUBJECTS, REPORTING_PERIODS, IEP_GOAL_AREAS } from '../types';
import { encryptedStorage } from '../utils/encryptedStorage';

export { MARYLAND_GRADES, MARYLAND_SUBJECTS, REPORTING_PERIODS, IEP_GOAL_AREAS };

// Data-only portion of AppState (no action methods)
type AppData = Omit<AppState,
  'setSessionId' | 'addSession' | 'createSession' | 'addImage' | 'setCurrentImageId' |
  'removeImage' | 'setUploadState' | 'resetUpload' | 'addOCRResult' | 'setOCRState' |
  'resetOCR' | 'setExtractedTables' | 'setSelectedTableIds' | 'toggleTableSelection' |
  'addSummary' | 'setCurrentSummaryId' | 'setSummaryState' | 'resetSummary' |
  'updateFormData' | 'setCurrentStep' | 'goToUpload' | 'goToOCR' | 'goToTables' |
  'goToSummary' | 'setIsMobile' | 'setHasCameraAccess' | 'addReportToHistory' |
  'removeReportFromHistory' | 'clearHistory' | 'setPrivacyConsent' | 'updateActivity' |
  'resetAll'
>;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function purgeOldReports(reports: ReportRecord[]): ReportRecord[] {
  const cutoff = Date.now() - NINETY_DAYS_MS;
  return reports.filter((report) => {
    const createdMs = new Date(report.createdAt).getTime();
    return createdMs >= cutoff;
  });
}

const initialState: AppData = {
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
    report_type: 'iep_progress_monitoring' as const,
    student_name: '',
    grade_level: MARYLAND_GRADES[2], // Default to Grade 1
    subject: MARYLAND_SUBJECTS[0], // Default to Reading/Literacy
    case_manager: '',
    teacher_name: '',
    school: '',
    native_language: 'English',
    reporting_period: REPORTING_PERIODS[0], // Default to Q1
    include_standards: true,
    include_iep_goals: true,
    include_behavioral: true,
  },
  
  // Report history
  reportHistory: [],

  // Privacy & compliance
  privacyConsent: null,

  // Session timeout
  lastActivityAt: Date.now(),

  // UI state
  currentStep: 'upload',
  is_mobile: false,
  has_camera_access: false,
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, _get) => ({
        ...initialState,
        
        // Actions
        setSessionId: (sessionId: string | null) => set({ sessionId }),
        
        addSession: (session: SessionType) => set((state) => ({
          sessions: [...state.sessions, session],
        })),

        addImage: (image: ImageType & { preview_url?: string }) => set((state) => ({
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
        
        addOCRResult: (imageId: string, result: OCRResult) => set((state) => ({
          ocrResults: { ...state.ocrResults, [imageId]: result },
        })),
        
        setOCRState: (ocr: Partial<AppState['ocr']>) => set((state) => ({
          ocr: { ...state.ocr, ...ocr },
        })),
        
        setExtractedTables: (tables: TableData[]) => set({ extractedTables: tables }),
        
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
        
        addSummary: (summary: GenerateSummaryResponse) => set((state) => ({
          summaries: [...state.summaries, summary],
          currentSummaryId: summary.completed_at,
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
        
        addReportToHistory: (report: ReportRecord) => set((state) => ({
          reportHistory: [report, ...state.reportHistory].slice(0, 50),
        })),

        removeReportFromHistory: (reportId: string) => set((state) => ({
          reportHistory: state.reportHistory.filter((r) => r.id !== reportId),
        })),

        clearHistory: () => set({ reportHistory: [] }),

        setPrivacyConsent: (consent: PrivacyConsent | null) => set({ privacyConsent: consent }),

        updateActivity: () => set({ lastActivityAt: Date.now() }),

        resetAll: () => set({
          ...initialState,
          reportHistory: _get().reportHistory,
          privacyConsent: _get().privacyConsent,
          lastActivityAt: Date.now(),
        }),
        
        // Navigation helpers
        goToUpload: () => set({ currentStep: 'upload' }),
        goToOCR: () => set({ currentStep: 'ocr' }),
        goToTables: () => set({ currentStep: 'tables' }),
        goToSummary: () => set({ currentStep: 'summary' }),
      }),
      {
        name: 'qpr-app-storage',
        storage: createJSONStorage(() => encryptedStorage),
        partialize: (state) => ({
          formData: state.formData,
          currentStep: state.currentStep,
          reportHistory: state.reportHistory,
          privacyConsent: state.privacyConsent,
        }),
        onRehydrateStorage: () => {
          return (state) => {
            if (state && state.reportHistory && state.reportHistory.length > 0) {
              const purged = purgeOldReports(state.reportHistory);
              if (purged.length !== state.reportHistory.length) {
                state.reportHistory = purged;
              }
            }
          };
        },
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

export const useReportHistory = () => useAppStore((state) => ({
  reportHistory: state.reportHistory,
  addReportToHistory: state.addReportToHistory,
  removeReportFromHistory: state.removeReportFromHistory,
  clearHistory: state.clearHistory,
}));

export const useUIState = () => useAppStore((state) => ({
  is_mobile: state.is_mobile,
  has_camera_access: state.has_camera_access,
  setIsMobile: state.setIsMobile,
  setHasCameraAccess: state.setHasCameraAccess,
}));

export default useAppStore;
