// OCR processing page
import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  VStack,
  useToast,
  Spinner,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Card,
  CardBody,
  CardHeader,
  Select,
  Icon
} from '@chakra-ui/react';
import { FiArrowRight, FiEye, FiCopy, FiCheck, FiAlertCircle } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { API } from '../utils/api';
import { useImages, useOCR, useSession, useNavigation } from '../stores/appStore';

function OCRPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [ocrText, setOcrText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const { images, currentImageId } = useImages();
  const { ocr, addOCRResult, setOCRState } = useOCR();
  const { sessionId } = useSession();
  const { goToTables } = useNavigation();
  
  // Select first image if none selected
  useEffect(() => {
    if (images.length > 0 && !selectedImageId) {
      setSelectedImageId(images[0].image_id);
    }
  }, [images, selectedImageId, currentImageId]);
  
  // Process OCR
  const processOCR = async () => {
    if (!selectedImageId) {
      toast({
        title: 'No image selected',
        description: 'Please select an image to process',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsProcessing(true);
    setProgress(0);
    setOCRState({ is_processing: true, progress: 0, error: null });
    
    // Simulate progress — declared outside try/catch so catch can clear it
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await API.ocr.process({
        image_id: selectedImageId,
        language: 'eng',
        enhance_image: false,
        use_mistral: true,
      }, sessionId || undefined);

      clearInterval(progressInterval);
      setProgress(100);

      // Store result
      addOCRResult(selectedImageId, result);
      setOcrText(result.text);

      setOCRState({ is_processing: false, progress: 100, error: null });
      setIsProcessing(false);

      toast({
        title: 'OCR Complete',
        description: `Text extracted successfully using ${result.model_used}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error) {
      clearInterval(progressInterval);
      setIsProcessing(false);
      setOCRState({ 
        is_processing: false, 
        progress: 0, 
        error: error instanceof Error ? error.message : 'OCR failed' 
      });
      
      toast({
        title: 'OCR Failed',
        description: error instanceof Error ? error.message : 'Failed to process OCR',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Copy text to clipboard
  const copyToClipboard = () => {
    if (!ocrText) return;
    
    navigator.clipboard.writeText(ocrText).then(() => {
      setCopied(true);
      toast({
        title: 'Copied',
        description: 'OCR text copied to clipboard',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy text',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    });
  };
  
  // Continue to tables
  const handleContinue = () => {
    if (!ocrText) {
      toast({
        title: 'No OCR text',
        description: 'Please process OCR first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    goToTables();
    navigate('/tables');
  };
  
  // Go back
  const handleBack = () => {
    navigate('/upload');
  };
  
  return (
    <VStack spacing={6} align="stretch">
      {/* Page Header */}
      <Box textAlign="center">
        <Heading as="h2" size="lg" mb={2}>
          OCR Processing
        </Heading>
        <Text color="gray.600">
          Extract text from student work images
        </Text>
      </Box>
      
      {/* Error Alert */}
      {ocr.error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>OCR Error</AlertTitle>
            <AlertDescription>{ocr.error}</AlertDescription>
          </Box>
        </Alert>
      )}
      
      {/* Image Selection */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <Text fontWeight="bold">Select Image</Text>
          </CardHeader>
          <CardBody>
            <Select 
              value={selectedImageId || ''} 
              onChange={(e) => setSelectedImageId(e.target.value)}
              placeholder="Select an image"
            >
              {images.map((image) => (
                <option key={image.image_id} value={image.image_id}>
                  {image.filename} ({image.width}x{image.height})
                </option>
              ))}
            </Select>
          </CardBody>
        </Card>
      )}
      
      {/* Process Button */}
      <Button 
        colorScheme="blue" 
        onClick={processOCR} 
        isLoading={isProcessing || ocr.is_processing}
        isDisabled={!selectedImageId || images.length === 0}
        size="lg"
        leftIcon={isProcessing ? <Spinner size="sm" /> : <FiEye />}
      >
        {isProcessing ? 'Processing...' : 'Process OCR'}
      </Button>
      
      {/* Progress Bar */}
      {(isProcessing || ocr.is_processing) && (
        <Box>
          <Progress value={progress || ocr.progress} size="sm" borderRadius="md" />
          <Text fontSize="xs" color="gray.500" mt={1}>
            Processing: {Math.round(progress || ocr.progress)}%
          </Text>
        </Box>
      )}
      
      {/* OCR Results */}
      {ocrText && (
        <Card>
          <CardHeader 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center"
          >
            <Text fontWeight="bold">Extracted Text</Text>
            <Button 
              leftIcon={copied ? <FiCheck /> : <FiCopy />} 
              size="sm" 
              onClick={copyToClipboard}
              colorScheme={copied ? 'green' : 'gray'}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </CardHeader>
          <CardBody>
            <Box
              bg="gray.50"
              p={4}
              borderRadius="md"
              overflowX="auto"
              maxH="500px"
              overflowY="auto"
              fontSize="sm"
              sx={{
                'table': { width: '100%', borderCollapse: 'collapse', my: 3 },
                'th, td': { border: '1px solid', borderColor: 'gray.300', px: 3, py: 2, textAlign: 'left' },
                'th': { bg: 'blue.600', color: 'white', fontWeight: 'bold' },
                'tr:nth-of-type(even)': { bg: 'gray.100' },
                'h1, h2, h3': { mt: 3, mb: 1 },
                'p': { my: 1 },
                'ul, ol': { pl: 5 },
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{ocrText}</ReactMarkdown>
            </Box>
          </CardBody>
        </Card>
      )}
      
      {/* Navigation Buttons */}
      <Flex justify="space-between" align="center" w="full">
        <Button 
          colorScheme="gray" 
          onClick={handleBack}
          leftIcon={<Icon as={FiAlertCircle} />}
        >
          Back
        </Button>
        <Button 
          colorScheme="blue" 
          onClick={handleContinue}
          isDisabled={!ocrText}
          rightIcon={<FiArrowRight />}
        >
          Continue to Tables
        </Button>
      </Flex>
    </VStack>
  );
}

export default OCRPage;
