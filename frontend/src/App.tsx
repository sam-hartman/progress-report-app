// Main App component — single-page layout
import { useEffect } from 'react';
import { useMediaQuery } from '@chakra-ui/react';
import { useUIState } from './stores/appStore';
import ReportPage from './pages/ReportPage';
import Header from './components/Header';

function App() {
  const [isMobile] = useMediaQuery('(max-width: 768px)');
  const { setIsMobile, setHasCameraAccess } = useUIState();

  useEffect(() => {
    setIsMobile(isMobile);
  }, [isMobile, setIsMobile]);

  // Check camera access on mobile
  useEffect(() => {
    if (!isMobile) return;
    const checkCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setHasCameraAccess(true);
      } catch {
        setHasCameraAccess(false);
      }
    };
    checkCamera();
  }, [isMobile, setHasCameraAccess]);

  return (
    <div className="app">
      <Header />
      <main className="page">
        <ReportPage />
      </main>
    </div>
  );
}

export default App;
