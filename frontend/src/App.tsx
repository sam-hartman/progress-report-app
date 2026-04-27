// Main App component with routing and layout
import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@chakra-ui/react';
import { useAppStore, useUIState } from './stores/appStore';
import UploadPage from './pages/UploadPage';
import OCRPage from './pages/OCRPage';
import TablesPage from './pages/TablesPage';
import SummaryPage from './pages/SummaryPage';
import MobileNav from './components/MobileNav';
import Header from './components/Header';
import StepIndicator from './components/StepIndicator';

function App() {
  const location = useLocation();
  const [isMobile] = useMediaQuery('(max-width: 768px)');
  const { setIsMobile, setHasCameraAccess } = useUIState();
  
  // Set mobile state
  useEffect(() => {
    setIsMobile(isMobile);
  }, [isMobile, setIsMobile]);
  
  // Check camera access
  useEffect(() => {
    const checkCameraAccess = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
        stream.getTracks().forEach(track => track.stop());
        setHasCameraAccess(true);
      } catch {
        setHasCameraAccess(false);
      }
    };
    
    // Only check on mobile
    if (isMobile) {
      checkCameraAccess();
    }
  }, [isMobile, setHasCameraAccess]);
  
  // Determine current step from route
  const getCurrentStep = (pathname: string): 'upload' | 'ocr' | 'tables' | 'summary' => {
    if (pathname.includes('/summary')) return 'summary';
    if (pathname.includes('/tables')) return 'tables';
    if (pathname.includes('/ocr')) return 'ocr';
    return 'upload';
  };
  
  const currentStep = getCurrentStep(location.pathname);
  const { setCurrentStep } = useAppStore();
  
  useEffect(() => {
    setCurrentStep(currentStep);
  }, [currentStep, setCurrentStep]);
  
  return (
    <div className="app">
      {/* Header */}
      <Header />
      
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />
      
      {/* Main Content */}
      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/ocr" element={<OCRPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Routes>
      </main>
      
      {/* Mobile Navigation */}
      {isMobile && <MobileNav currentStep={currentStep} />}
    </div>
  );
}

export default App;
