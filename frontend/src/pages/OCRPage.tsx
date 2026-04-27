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
  FormControl,
  FormLabel,
  Checkbox,
  Stack,
  Icon
} from '@chakra-ui/react';
import { FiArrowRight, FiEye, FiCopy, FiCheck, FiAlertCircle } from 'react-icons/fi';
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
  const [language, setLanguage] = useState('eng');
  const [enhanceImage, setEnhanceImage] = useState(true);
  const [useMistral, setUseMistral] = useState(true);
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
        language,
        enhance_image: enhanceImage,
        use_mistral: useMistral,
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
      
      {/* OCR Options */}
      <Card>
        <CardHeader>
          <Text fontWeight="bold">OCR Options</Text>
        </CardHeader>
        <CardBody>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>Language</FormLabel>
              <Select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="eng">English</option>
                <option value="spa">Spanish</option>
                <option value="fra">French</option>
                <option value="deu">German</option>
              </Select>
            </FormControl>
            
            <Checkbox 
              isChecked={enhanceImage} 
              onChange={(e) => setEnhanceImage(e.target.checked)}
            >
              Enhance image for better OCR results
            </Checkbox>
            
            <Checkbox 
              isChecked={useMistral} 
              onChange={(e) => setUseMistral(e.target.checked)}
              isDisabled={!import.meta.env.VITE_MISTRAL_API_KEY}
            >
              Use Mistral AI for OCR (more accurate)
              {!import.meta.env.VITE_MISTRAL_API_KEY && (
                <Text fontSize="xs" color="gray.500" ml={2}>
                  (Mistral API key not configured)
                </Text>
              )}
            </Checkbox>
          </Stack>
        </CardBody>
      </Card>
      
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
              as="pre"
              whiteSpace="pre-wrap"
              overflowWrap="break-word"
              fontFamily="monospace" 
              fontSize="sm" 
              bg="gray.50" 
              p={4} 
              borderRadius="md"
              overflowX="auto"
              maxH="400px"
              overflowY="auto"
            >
              {ocrText}
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
