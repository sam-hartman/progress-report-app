// Single-page report generator: upload images → fill student info → get report
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  VStack,
  useToast,
  Image,
  Icon,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
  Input,
  Select,
  Checkbox,
  Stack,
  Divider,
  IconButton,
  Spinner,
} from '@chakra-ui/react';
import {
  FiUpload,
  FiCamera,
  FiX,
  FiCheckCircle,
  FiFileText,
  FiCopy,
  FiCheck,
  FiPrinter,
  FiDownload,
  FiRefreshCw,
  FiEye,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API } from '../utils/api';
import {
  useAppStore,
  useImages,
  useUpload,
  useSession,
  useFormData,
  useSummary,
} from '../stores/appStore';
import {
  MARYLAND_GRADES,
  MARYLAND_SUBJECTS,
  REPORTING_PERIODS,
} from '../types';

function ReportPage() {
  const toast = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrPreviewTexts, setOcrPreviewTexts] = useState<{ filename: string; text: string }[]>([]);
  const [showOcrPreview, setShowOcrPreview] = useState(true);

  const { images, addImage, removeImage } = useImages();
  const { upload, setUploadState } = useUpload();
  const { sessionId } = useSession();
  const { formData, updateFormData } = useFormData();
  const { addSummary } = useSummary();

  // Create session on mount
  useEffect(() => {
    if (!sessionId) {
      const createSession = async () => {
        try {
          const session = await API.session.create();
          useAppStore.getState().setSessionId(session.session_id);
        } catch {
          toast({
            title: 'Connection Error',
            description: 'Could not connect to server. Please try again.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      };
      createSession();
    }
  }, [sessionId, toast]);

  // Handle file drop — supports multiple files
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploadState({ is_uploading: true, upload_progress: 0, error: null });

    for (const file of acceptedFiles) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file',
          description: `${file.name} is not an image file`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds the 10MB limit`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        continue;
      }

      try {
        const image = await API.image.upload(file, sessionId || undefined);
        addImage({
          ...image,
          preview_url: URL.createObjectURL(file),
          status: 'uploaded' as const,
        });
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: `Failed to upload ${file.name}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }

    setUploadState({ is_uploading: false, upload_progress: 100, error: null });
  }, [addImage, sessionId, setUploadState, toast]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    multiple: true,
    noClick: true,
  });

  // Camera capture
  const captureImage = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: 'Camera not available',
        description: 'Your device does not support camera access',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      await new Promise((resolve) => { video.onloadedmetadata = resolve; });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const image = await API.image.upload(file, sessionId || undefined);
            addImage({
              ...image,
              preview_url: URL.createObjectURL(file),
              status: 'uploaded' as const,
            });
            toast({ title: 'Photo captured', status: 'success', duration: 2000, isClosable: true });
          }
          stream.getTracks().forEach(track => track.stop());
        }, 'image/jpeg', 0.9);
      }
    } catch {
      toast({ title: 'Camera error', description: 'Failed to access camera', status: 'error', duration: 3000, isClosable: true });
    }
  };

  // Generate report: OCR all images → combine text → generate summary
  const generateReport = async () => {
    if (images.length === 0) {
      toast({ title: 'No images', description: 'Upload at least one image of student work', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSummaryText('');
    setOcrPreviewTexts([]);

    try {
      // Step 1: OCR each image
      setGenerationStatus(`Reading text from ${images.length} image${images.length > 1 ? 's' : ''}...`);
      const ocrTexts: string[] = [];
      const ocrPreviews: { filename: string; text: string }[] = [];

      for (const image of images) {
        setGenerationStatus(`Reading ${image.filename}...`);
        const result = await API.ocr.process({
          image_id: image.image_id,
          language: 'eng',
          enhance_image: false,
          use_mistral: true,
        }, sessionId || undefined);
        ocrTexts.push(result.text);
        ocrPreviews.push({ filename: image.filename, text: result.text });
      }

      setOcrPreviewTexts(ocrPreviews);
      setShowOcrPreview(true);
      const combinedText = ocrTexts.join('\n\n---\n\n');

      // Step 2: Generate summary from combined OCR text
      setGenerationStatus('Generating progress report...');
      const result = await API.summary.generate({
        text: combinedText,
        template: 'maryland_qpr',
        grade_level: formData.grade_level,
        subject: formData.subject,
        student_name: formData.student_name || undefined,
        teacher_name: formData.teacher_name || undefined,
        school: formData.school || undefined,
        reporting_period: formData.reporting_period,
        include_standards: formData.include_standards,
        include_iep_goals: formData.include_iep_goals,
        include_behavioral: formData.include_behavioral,
      }, sessionId || undefined);

      addSummary(result);
      setSummaryText(result.summary_text);
      setGenerationStatus('');
      toast({ title: 'Report generated', status: 'success', duration: 3000, isClosable: true });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Report generation failed';
      setError(message);
      setGenerationStatus('');
      toast({ title: 'Generation failed', description: message, status: 'error', duration: 5000, isClosable: true });
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    if (!summaryText) return;
    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true);
      toast({ title: 'Copied to clipboard', status: 'success', duration: 2000, isClosable: true });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast({ title: 'Copy failed', status: 'error', duration: 2000, isClosable: true });
    });
  };

  // Print
  const handlePrint = () => {
    setTimeout(() => window.print(), 100);
  };

  // Download
  const handleDownload = () => {
    if (!summaryText) return;
    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `progress_report_${formData.student_name || 'student'}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', status: 'success', duration: 2000, isClosable: true });
  };

  // Start over
  const handleStartOver = () => {
    useAppStore.getState().resetAll();
    setSummaryText('');
    setOcrPreviewTexts([]);
    setError(null);
    setGenerationStatus('');
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Upload Section */}
      <Card>
        <CardHeader pb={2}>
          <Heading as="h3" size="md">1. Upload Student Work</Heading>
          <Text fontSize="sm" color="gray.500">
            Upload one or more images of student work (JPEG, PNG, WebP, max 10MB each)
          </Text>
        </CardHeader>
        <CardBody>
          {/* Dropzone */}
          <Box
            {...getRootProps()}
            border="2px dashed"
            borderColor={isDragActive ? 'blue.500' : 'gray.300'}
            borderRadius="lg"
            p={6}
            textAlign="center"
            transition="all 0.2s"
            bg={isDragActive ? 'blue.50' : 'gray.50'}
            mb={4}
          >
            <input {...getInputProps()} />
            <Icon as={FiUpload} boxSize={8} color="gray.400" mb={2} />
            <Text fontWeight="medium" mb={3}>
              {isDragActive ? 'Drop images here' : 'Drag & drop images here'}
            </Text>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={open}
              isDisabled={upload.is_uploading}
            >
              Browse Files
            </Button>
          </Box>

          {/* Camera button */}
          <Button
            leftIcon={<FiCamera />}
            size="sm"
            variant="outline"
            onClick={captureImage}
            isDisabled={upload.is_uploading}
            mb={4}
          >
            Take Photo
          </Button>

          {/* Upload error */}
          {upload.error && (
            <Alert status="error" borderRadius="md" mb={4}>
              <AlertIcon />
              <AlertDescription>{upload.error}</AlertDescription>
            </Alert>
          )}

          {/* Image thumbnails */}
          {images.length > 0 && (
            <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={3}>
              {images.map((image) => (
                <Box key={image.image_id} position="relative" borderRadius="md" overflow="hidden" border="1px solid" borderColor="gray.200">
                  {image.preview_url && (
                    <Image
                      src={image.preview_url}
                      alt={image.filename}
                      h="120px"
                      w="100%"
                      objectFit="cover"
                    />
                  )}
                  <Flex align="center" justify="space-between" px={2} py={1} bg="gray.50">
                    <Text fontSize="xs" color="gray.600" noOfLines={1} flex={1}>
                      {image.filename}
                    </Text>
                    <IconButton
                      aria-label="Remove image"
                      icon={<FiX />}
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => removeImage(image.image_id)}
                    />
                  </Flex>
                  <Icon
                    as={FiCheckCircle}
                    color="green.500"
                    position="absolute"
                    top={1}
                    right={1}
                    boxSize={4}
                  />
                </Box>
              ))}
            </SimpleGrid>
          )}

          {upload.is_uploading && (
            <Flex align="center" gap={2} mt={2}>
              <Spinner size="sm" />
              <Text fontSize="sm" color="gray.500">Uploading...</Text>
            </Flex>
          )}
        </CardBody>
      </Card>

      {/* Student Info Section */}
      <Card>
        <CardHeader pb={2}>
          <Heading as="h3" size="md">2. Student Information</Heading>
          <Text fontSize="sm" color="gray.500">Optional — fill in what you have</Text>
        </CardHeader>
        <CardBody>
          <Stack spacing={4} direction={{ base: 'column', md: 'row' }}>
            <FormControl>
              <FormLabel fontSize="sm">Student Name</FormLabel>
              <Input
                size="sm"
                value={formData.student_name}
                onChange={(e) => updateFormData({ student_name: e.target.value })}
                placeholder="Enter student name"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Grade Level</FormLabel>
              <Select
                size="sm"
                value={formData.grade_level}
                onChange={(e) => updateFormData({ grade_level: e.target.value })}
              >
                {MARYLAND_GRADES.map((grade: string) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Subject</FormLabel>
              <Select
                size="sm"
                value={formData.subject}
                onChange={(e) => updateFormData({ subject: e.target.value })}
              >
                {MARYLAND_SUBJECTS.map((subject: string) => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Divider my={3} />

          <Stack spacing={4} direction={{ base: 'column', md: 'row' }}>
            <FormControl>
              <FormLabel fontSize="sm">Teacher Name</FormLabel>
              <Input
                size="sm"
                value={formData.teacher_name}
                onChange={(e) => updateFormData({ teacher_name: e.target.value })}
                placeholder="Enter teacher name"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">School</FormLabel>
              <Input
                size="sm"
                value={formData.school}
                onChange={(e) => updateFormData({ school: e.target.value })}
                placeholder="Enter school name"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Reporting Period</FormLabel>
              <Select
                size="sm"
                value={formData.reporting_period}
                onChange={(e) => updateFormData({ reporting_period: e.target.value })}
              >
                {REPORTING_PERIODS.map((period: string) => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Divider my={3} />

          <Stack spacing={4} direction={{ base: 'column', sm: 'row' }}>
            <Checkbox
              size="sm"
              isChecked={formData.include_standards}
              onChange={(e) => updateFormData({ include_standards: e.target.checked })}
            >
              Maryland Standards
            </Checkbox>
            <Checkbox
              size="sm"
              isChecked={formData.include_iep_goals}
              onChange={(e) => updateFormData({ include_iep_goals: e.target.checked })}
            >
              IEP Goals
            </Checkbox>
            <Checkbox
              size="sm"
              isChecked={formData.include_behavioral}
              onChange={(e) => updateFormData({ include_behavioral: e.target.checked })}
            >
              Behavioral Notes
            </Checkbox>
          </Stack>
        </CardBody>
      </Card>

      {/* Generate Button */}
      <Button
        colorScheme="blue"
        size="lg"
        onClick={generateReport}
        isLoading={isGenerating}
        loadingText={generationStatus || 'Generating...'}
        isDisabled={images.length === 0 || upload.is_uploading}
        leftIcon={<FiFileText />}
      >
        Generate Progress Report
      </Button>

      {/* Error */}
      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      )}

      {/* OCR Preview */}
      {ocrPreviewTexts.length > 0 && (
        <Card>
          <CardHeader
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            cursor="pointer"
            onClick={() => setShowOcrPreview(!showOcrPreview)}
            _hover={{ bg: 'gray.50' }}
            borderRadius="md"
          >
            <Flex align="center" gap={2}>
              <Icon as={FiEye} />
              <Heading as="h3" size="md">OCR Preview — Extracted Text</Heading>
              <Text fontSize="sm" color="gray.500">
                ({ocrPreviewTexts.length} image{ocrPreviewTexts.length > 1 ? 's' : ''})
              </Text>
            </Flex>
            <Icon as={showOcrPreview ? FiChevronUp : FiChevronDown} />
          </CardHeader>
          {showOcrPreview && (
            <CardBody pt={0}>
              <VStack spacing={4} align="stretch">
                {ocrPreviewTexts.map((ocr, idx) => (
                  <Box key={idx}>
                    {ocrPreviewTexts.length > 1 && (
                      <Text fontSize="sm" fontWeight="bold" color="blue.600" mb={1}>
                        {ocr.filename}
                      </Text>
                    )}
                    <Box
                      bg="gray.50"
                      p={4}
                      borderRadius="md"
                      maxH="400px"
                      overflowY="auto"
                      overflowX="auto"
                      fontSize="sm"
                      border="1px solid"
                      borderColor="gray.200"
                      sx={{
                        'table': { width: '100%', borderCollapse: 'collapse', my: 3 },
                        'th, td': { border: '1px solid', borderColor: 'gray.300', px: 3, py: 2, textAlign: 'left' },
                        'th': { bg: 'blue.600', color: 'white', fontWeight: 'bold' },
                        'tr:nth-of-type(even)': { bg: 'gray.100' },
                        'h1, h2, h3, h4': { mt: 3, mb: 1, fontWeight: 'bold' },
                        'h1': { fontSize: 'lg' },
                        'h2': { fontSize: 'md' },
                        'p': { my: 1 },
                        'ul, ol': { pl: 5, my: 1 },
                        'strong': { fontWeight: 'bold' },
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{ocr.text}</ReactMarkdown>
                    </Box>
                  </Box>
                ))}
              </VStack>
            </CardBody>
          )}
        </Card>
      )}

      {/* Report Output */}
      {summaryText && (
        <Card>
          <CardHeader
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={2}
          >
            <Heading as="h3" size="md">Generated Progress Report</Heading>
            <Flex gap={2}>
              <Button
                leftIcon={copied ? <FiCheck /> : <FiCopy />}
                size="sm"
                onClick={copyToClipboard}
                colorScheme={copied ? 'green' : 'gray'}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button leftIcon={<FiPrinter />} size="sm" onClick={handlePrint} colorScheme="gray">
                Print
              </Button>
              <Button leftIcon={<FiDownload />} size="sm" onClick={handleDownload} colorScheme="gray">
                Download
              </Button>
            </Flex>
          </CardHeader>
          <CardBody>
            <Box
              className="report-output"
              p={4}
              borderRadius="md"
              border="1px solid"
              borderColor="gray.200"
              bg="white"
              fontSize="md"
              lineHeight="1.7"
              sx={{
                'table': { width: '100%', borderCollapse: 'collapse', my: 3 },
                'th, td': { border: '1px solid', borderColor: 'gray.300', px: 3, py: 2, textAlign: 'left' },
                'th': { bg: 'blue.600', color: 'white', fontWeight: 'bold' },
                'tr:nth-of-type(even)': { bg: 'gray.50' },
                'h1, h2, h3, h4': { mt: 4, mb: 2, fontWeight: 'bold' },
                'h1': { fontSize: 'xl' },
                'h2': { fontSize: 'lg' },
                'h3': { fontSize: 'md' },
                'p': { my: 2 },
                'ul, ol': { pl: 5, my: 2 },
                'li': { my: 1 },
                'strong': { fontWeight: 'bold' },
                'em': { fontStyle: 'italic' },
                'hr': { my: 4, borderColor: 'gray.200' },
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryText}</ReactMarkdown>
            </Box>
          </CardBody>
        </Card>
      )}

      {/* Bottom actions */}
      {summaryText && (
        <Flex justify="center">
          <Button
            leftIcon={<FiRefreshCw />}
            onClick={handleStartOver}
            variant="outline"
            colorScheme="gray"
          >
            Start Over
          </Button>
        </Flex>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          .maryland-header, .no-print { display: none !important; }
          .report-output { border: none !important; }
        }
      `}</style>
    </VStack>
  );
}

export default ReportPage;
