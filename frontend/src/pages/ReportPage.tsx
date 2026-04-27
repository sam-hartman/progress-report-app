// Single-page report generator
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Button,
  Flex,
  Text,
  VStack,
  HStack,
  useToast,
  Image,
  Icon,
  Alert,
  AlertIcon,
  AlertDescription,
  SimpleGrid,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Input,
  Select,
  Checkbox,
  Stack,
  Divider,
  IconButton,
  Spinner,
  Badge,
} from '@chakra-ui/react';
import {
  FiUpload,
  FiCamera,
  FiX,
  FiCopy,
  FiCheck,
  FiPrinter,
  FiDownload,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { downloadAsDocx } from '../utils/markdownToDocx';
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
  const [showOcrPreview, setShowOcrPreview] = useState(false);

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
            title: 'Connection error',
            description: 'Could not connect to server.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      };
      createSession();
    }
  }, [sessionId, toast]);

  // File drop handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploadState({ is_uploading: true, upload_progress: 0, error: null });

    for (const file of acceptedFiles) {
      if (!file.type.startsWith('image/')) {
        toast({ title: `${file.name} is not an image`, status: 'error', duration: 3000, isClosable: true });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: `${file.name} exceeds 10MB limit`, status: 'error', duration: 3000, isClosable: true });
        continue;
      }
      try {
        const image = await API.image.upload(file, sessionId || undefined);
        addImage({ ...image, preview_url: URL.createObjectURL(file), status: 'uploaded' as const });
      } catch {
        toast({ title: `Failed to upload ${file.name}`, status: 'error', duration: 3000, isClosable: true });
      }
    }
    setUploadState({ is_uploading: false, upload_progress: 100, error: null });
  }, [addImage, sessionId, setUploadState, toast]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpeg', '.jpg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    multiple: true,
    noClick: true,
  });

  // Camera capture
  const captureImage = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ title: 'Camera not available', status: 'error', duration: 3000, isClosable: true });
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
            addImage({ ...image, preview_url: URL.createObjectURL(file), status: 'uploaded' as const });
          }
          stream.getTracks().forEach(track => track.stop());
        }, 'image/jpeg', 0.9);
      }
    } catch {
      toast({ title: 'Failed to access camera', status: 'error', duration: 3000, isClosable: true });
    }
  };

  // Generate report pipeline
  const generateReport = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setSummaryText('');
    setOcrPreviewTexts([]);

    try {
      const totalSteps = images.length + 1;
      const ocrTexts: string[] = [];
      const ocrPreviews: { filename: string; text: string }[] = [];

      for (let idx = 0; idx < images.length; idx++) {
        const image = images[idx];
        setGenerationStatus(`Step ${idx + 1} of ${totalSteps} -- Extracting text from ${image.filename}`);
        const result = await API.ocr.process({
          image_id: image.image_id, language: 'eng', enhance_image: false, use_mistral: true,
        }, sessionId || undefined);
        ocrTexts.push(result.text);
        ocrPreviews.push({ filename: image.filename, text: result.text });
      }

      setOcrPreviewTexts(ocrPreviews);
      const combinedText = ocrTexts.join('\n\n---\n\n');

      setGenerationStatus(`Step ${totalSteps} of ${totalSteps} -- Writing progress report`);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Report generation failed';
      setError(message);
      setGenerationStatus('');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!summaryText) return;
    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => setTimeout(() => window.print(), 100);

  const handleDownload = async () => {
    if (!summaryText) return;
    const filename = `progress_report_${formData.student_name || 'student'}_${Date.now()}.docx`;
    try {
      await downloadAsDocx(summaryText, filename);
    } catch {
      toast({ title: 'Download failed', status: 'error', duration: 3000, isClosable: true });
    }
  };

  const handleStartOver = () => {
    useAppStore.getState().resetAll();
    setSummaryText('');
    setOcrPreviewTexts([]);
    setError(null);
    setGenerationStatus('');
  };

  // Shared markdown styles
  const markdownStyles = {
    'table': { width: '100%', borderCollapse: 'collapse', my: 3 },
    'th, td': { border: '1px solid', borderColor: 'gray.300', px: 3, py: 2, textAlign: 'left', fontSize: 'sm' },
    'th': { bg: 'brand.700', color: 'white', fontWeight: 600, fontSize: 'xs', textTransform: 'uppercase', letterSpacing: '0.03em' },
    'tr:nth-of-type(even)': { bg: 'gray.50' },
    'h1, h2, h3, h4': { mt: 4, mb: 2, fontWeight: 700, color: 'gray.800' },
    'h1': { fontSize: 'lg', borderBottom: '2px solid', borderColor: 'brand.600', pb: 1 },
    'h2': { fontSize: 'md', color: 'brand.700' },
    'h3': { fontSize: 'sm', color: 'brand.600' },
    'p': { my: 2, lineHeight: 1.7 },
    'ul, ol': { pl: 5, my: 2 },
    'li': { my: 1, lineHeight: 1.6 },
    'strong': { fontWeight: 700 },
    'em': { fontStyle: 'italic' },
    'hr': { my: 4, borderColor: 'gray.200' },
  };

  return (
    <Box maxW="960px" mx="auto" px={{ base: 4, md: 6 }} py={6}>
      <VStack spacing={5} align="stretch">

        {/* Upload */}
        <Card variant="outline">
          <CardBody>
            <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600" mb={3}>
              Student Work
            </Text>

            <Box
              {...getRootProps()}
              border="2px dashed"
              borderColor={isDragActive ? 'brand.500' : 'gray.300'}
              borderRadius="md"
              p={5}
              textAlign="center"
              transition="all 0.15s"
              bg={isDragActive ? 'brand.50' : 'gray.50'}
              _hover={{ borderColor: 'brand.400', bg: 'gray.100' }}
              mb={3}
            >
              <input {...getInputProps()} />
              <Icon as={FiUpload} boxSize={6} color="gray.400" mb={2} />
              <Text fontSize="sm" color="gray.600" mb={2}>
                {isDragActive ? 'Drop files here' : 'Drag and drop images, or'}
              </Text>
              <Button size="sm" variant="outline" colorScheme="blue" onClick={open} isDisabled={upload.is_uploading}>
                Browse Files
              </Button>
            </Box>

            <Button
              leftIcon={<FiCamera />} size="xs" variant="ghost" color="gray.500"
              onClick={captureImage} isDisabled={upload.is_uploading}
            >
              Use Camera
            </Button>

            {upload.error && (
              <Alert status="error" borderRadius="md" mt={3} py={2}>
                <AlertIcon boxSize={4} />
                <AlertDescription fontSize="sm">{upload.error}</AlertDescription>
              </Alert>
            )}

            {images.length > 0 && (
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2} mt={3}>
                {images.map((image) => (
                  <Box
                    key={image.image_id}
                    position="relative"
                    borderRadius="md"
                    overflow="hidden"
                    border="1px solid"
                    borderColor="gray.200"
                    bg="white"
                  >
                    {image.preview_url && (
                      <Image src={image.preview_url} alt={image.filename} h="80px" w="100%" objectFit="cover" />
                    )}
                    <Flex align="center" justify="space-between" px={2} py={1}>
                      <Text fontSize="2xs" color="gray.500" noOfLines={1} flex={1}>{image.filename}</Text>
                      <IconButton
                        aria-label="Remove"
                        icon={<FiX />}
                        size="xs"
                        variant="ghost"
                        color="gray.400"
                        _hover={{ color: 'red.500' }}
                        onClick={() => removeImage(image.image_id)}
                      />
                    </Flex>
                  </Box>
                ))}
              </SimpleGrid>
            )}

            {upload.is_uploading && (
              <Flex align="center" gap={2} mt={2}>
                <Spinner size="xs" color="brand.500" />
                <Text fontSize="xs" color="gray.500">Uploading...</Text>
              </Flex>
            )}

            {images.length > 0 && (
              <Text fontSize="xs" color="gray.400" mt={2}>
                {images.length} file{images.length !== 1 ? 's' : ''} attached
              </Text>
            )}
          </CardBody>
        </Card>

        {/* Student Information */}
        <Card variant="outline">
          <CardBody>
            <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600" mb={3}>
              Student Information
            </Text>

            <Stack spacing={3} direction={{ base: 'column', md: 'row' }}>
              <FormControl>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Student Name</FormLabel>
                <Input
                  size="sm" borderColor="gray.300" _hover={{ borderColor: 'gray.400' }}
                  value={formData.student_name}
                  onChange={(e) => updateFormData({ student_name: e.target.value })}
                  placeholder="Name"
                  autoComplete="off"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Grade</FormLabel>
                <Select size="sm" borderColor="gray.300" value={formData.grade_level} onChange={(e) => updateFormData({ grade_level: e.target.value })}>
                  {MARYLAND_GRADES.map((g: string) => <option key={g} value={g}>{g}</option>)}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Subject</FormLabel>
                <Select size="sm" borderColor="gray.300" value={formData.subject} onChange={(e) => updateFormData({ subject: e.target.value })}>
                  {MARYLAND_SUBJECTS.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormControl>
            </Stack>

            <Divider my={3} borderColor="gray.200" />

            <Stack spacing={3} direction={{ base: 'column', md: 'row' }}>
              <FormControl>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Teacher</FormLabel>
                <Input
                  size="sm" borderColor="gray.300" _hover={{ borderColor: 'gray.400' }}
                  value={formData.teacher_name}
                  onChange={(e) => updateFormData({ teacher_name: e.target.value })}
                  placeholder="Name"
                  autoComplete="off"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>School</FormLabel>
                <Input
                  size="sm" borderColor="gray.300" _hover={{ borderColor: 'gray.400' }}
                  value={formData.school}
                  onChange={(e) => updateFormData({ school: e.target.value })}
                  placeholder="School name"
                  autoComplete="off"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Period</FormLabel>
                <Select size="sm" borderColor="gray.300" value={formData.reporting_period} onChange={(e) => updateFormData({ reporting_period: e.target.value })}>
                  {REPORTING_PERIODS.map((p: string) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </FormControl>
            </Stack>

            <Divider my={3} borderColor="gray.200" />

            <HStack spacing={5}>
              <Checkbox size="sm" colorScheme="blue" isChecked={formData.include_standards} onChange={(e) => updateFormData({ include_standards: e.target.checked })}>
                <Text fontSize="xs" color="gray.600">Maryland Standards</Text>
              </Checkbox>
              <Checkbox size="sm" colorScheme="blue" isChecked={formData.include_iep_goals} onChange={(e) => updateFormData({ include_iep_goals: e.target.checked })}>
                <Text fontSize="xs" color="gray.600">IEP Goals</Text>
              </Checkbox>
              <Checkbox size="sm" colorScheme="blue" isChecked={formData.include_behavioral} onChange={(e) => updateFormData({ include_behavioral: e.target.checked })}>
                <Text fontSize="xs" color="gray.600">Behavioral</Text>
              </Checkbox>
            </HStack>
          </CardBody>
        </Card>

        {/* Generate */}
        <Button
          bg="brand.700"
          color="white"
          _hover={{ bg: 'brand.800' }}
          _active={{ bg: 'brand.900' }}
          size="md"
          onClick={generateReport}
          isLoading={isGenerating}
          loadingText={generationStatus || 'Processing...'}
          isDisabled={images.length === 0 || upload.is_uploading}
          fontWeight={600}
          letterSpacing="0.01em"
        >
          Generate Report
        </Button>

        {/* Error */}
        {error && (
          <Alert status="error" borderRadius="md" py={2}>
            <AlertIcon boxSize={4} />
            <AlertDescription fontSize="sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* OCR Preview */}
        {ocrPreviewTexts.length > 0 && (
          <Card variant="outline">
            <CardBody py={3}>
              <Flex
                justify="space-between"
                align="center"
                cursor="pointer"
                onClick={() => setShowOcrPreview(!showOcrPreview)}
                _hover={{ color: 'brand.600' }}
              >
                <HStack spacing={2}>
                  <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600">
                    Extracted Text
                  </Text>
                  <Badge colorScheme="blue" fontSize="2xs" variant="subtle">
                    {ocrPreviewTexts.length} source{ocrPreviewTexts.length !== 1 ? 's' : ''}
                  </Badge>
                </HStack>
                <Icon as={showOcrPreview ? FiChevronUp : FiChevronDown} color="gray.400" boxSize={4} />
              </Flex>

              {showOcrPreview && (
                <VStack spacing={3} align="stretch" mt={3}>
                  {ocrPreviewTexts.map((ocr, idx) => (
                    <Box key={idx}>
                      {ocrPreviewTexts.length > 1 && (
                        <Text fontSize="xs" fontWeight={600} color="gray.500" mb={1}>{ocr.filename}</Text>
                      )}
                      <Box
                        bg="gray.50" p={4} borderRadius="md" maxH="300px"
                        overflowY="auto" overflowX="auto" fontSize="sm"
                        border="1px solid" borderColor="gray.200"
                        sx={markdownStyles}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{ocr.text}</ReactMarkdown>
                      </Box>
                    </Box>
                  ))}
                </VStack>
              )}
            </CardBody>
          </Card>
        )}

        {/* Report Output */}
        {summaryText && (
          <Card variant="outline">
            <CardBody>
              <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
                <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600">
                  Progress Report
                </Text>
                <HStack spacing={1}>
                  <Button
                    leftIcon={copied ? <FiCheck /> : <FiCopy />}
                    size="xs" variant="ghost" color="gray.500"
                    onClick={copyToClipboard}
                    _hover={{ color: 'brand.600' }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button leftIcon={<FiPrinter />} size="xs" variant="ghost" color="gray.500" onClick={handlePrint} _hover={{ color: 'brand.600' }}>
                    Print
                  </Button>
                  <Button leftIcon={<FiDownload />} size="xs" variant="ghost" color="gray.500" onClick={handleDownload} _hover={{ color: 'brand.600' }}>
                    Word
                  </Button>
                </HStack>
              </Flex>

              <Box
                className="report-output"
                p={5}
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
                bg="white"
                fontSize="sm"
                sx={markdownStyles}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryText}</ReactMarkdown>
              </Box>
            </CardBody>
          </Card>
        )}

        {/* Reset */}
        {summaryText && (
          <Flex justify="center" pb={4}>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={handleStartOver}
              size="sm"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'gray.600' }}
            >
              New Report
            </Button>
          </Flex>
        )}

        <style>{`
          @media print {
            .maryland-header, .no-print { display: none !important; }
            .report-output { border: none !important; padding: 0 !important; }
          }
        `}</style>
      </VStack>
    </Box>
  );
}

export default ReportPage;
