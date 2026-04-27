// Single-page report generator
import { useState, useCallback, useEffect, useRef } from 'react';
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
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
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
  FiClock,
  FiTrash2,
  FiArrowLeft,
  FiInfo,
  FiAlertTriangle,
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
  useReportHistory,
} from '../stores/appStore';
import {
  ReportRecord,
  MARYLAND_GRADES,
  MARYLAND_SUBJECTS,
  REPORTING_PERIODS,
  IEP_GOAL_AREAS,
} from '../types';
import PrivacyConsentModal from '../components/PrivacyConsentModal';
import PrivacyBanner from '../components/PrivacyBanner';
import { logEvent } from '../utils/auditLog';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const TIMEOUT_CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

function ReportPage() {
  const toast = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrPreviewTexts, setOcrPreviewTexts] = useState<{ filename: string; text: string }[]>([]);
  const [showOcrPreview, setShowOcrPreview] = useState(false);
  const [viewingReport, setViewingReport] = useState<ReportRecord | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const { images, addImage, removeImage } = useImages();
  const { upload, setUploadState } = useUpload();
  const { sessionId } = useSession();
  const { formData, updateFormData } = useFormData();
  const { addSummary } = useSummary();
  const { reportHistory, addReportToHistory, removeReportFromHistory, clearHistory } = useReportHistory();

  // Clear All My Data dialog
  const {
    isOpen: isClearDialogOpen,
    onOpen: onClearDialogOpen,
    onClose: onClearDialogClose,
  } = useDisclosure();
  const clearDialogCancelRef = useRef<HTMLButtonElement>(null);

  const isFirstVisit = reportHistory.length === 0 && images.length === 0 && !summaryText;

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
            description: 'Could not connect to server. Please check your internet connection and refresh the page.',
            status: 'error',
            duration: 8000,
            isClosable: true,
          });
        }
      };
      createSession();
    }
  }, [sessionId, toast]);

  // Session timeout: clear in-memory state after 30 minutes of inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      const lastActivity = useAppStore.getState().lastActivityAt;
      if (lastActivity && Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
        // Clear in-memory working data but keep history and consent
        useAppStore.getState().resetAll();
        setSummaryText('');
        setOcrPreviewTexts([]);
        setError(null);
        setGenerationStatus('');
        setViewingReport(null);
        toast({
          title: 'Session timed out for privacy. Your saved reports are still available.',
          status: 'info',
          duration: 6000,
          isClosable: true,
        });
      }
    }, TIMEOUT_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [toast]);

  // Track user activity
  const handleUserActivity = useCallback(() => {
    const updateActivity = useAppStore.getState().updateActivity;
    if (typeof updateActivity === 'function') {
      updateActivity();
    }
  }, []);

  // Clear all data handler
  const handleClearAllData = useCallback(() => {
    useAppStore.getState().resetAll();
    clearHistory();
    localStorage.clear();
    setSummaryText('');
    setOcrPreviewTexts([]);
    setError(null);
    setGenerationStatus('');
    setViewingReport(null);
    logEvent('DATA_CLEARED');
    onClearDialogClose();
    toast({
      title: 'All your data has been cleared.',
      status: 'success',
      duration: 4000,
      isClosable: true,
    });
  }, [clearHistory, onClearDialogClose, toast]);

  // File drop handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploadState({ is_uploading: true, upload_progress: 0, error: null });

    for (const file of acceptedFiles) {
      if (!file.type.startsWith('image/')) {
        toast({ title: `"${file.name}" is not an image. Please use JPG, PNG, or WebP files.`, status: 'error', duration: 5000, isClosable: true });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: `"${file.name}" is too large. Maximum file size is 10MB.`, status: 'error', duration: 5000, isClosable: true });
        continue;
      }
      try {
        const image = await API.image.upload(file, sessionId || undefined);
        addImage({ ...image, preview_url: URL.createObjectURL(file), status: 'uploaded' as const });
        logEvent('IMAGE_UPLOADED', image.image_id);
      } catch {
        toast({ title: `Failed to upload "${file.name}". Please try again.`, status: 'error', duration: 5000, isClosable: true });
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
      toast({ title: 'Camera not available on this device.', status: 'error', duration: 5000, isClosable: true });
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
            logEvent('IMAGE_UPLOADED', image.image_id);
          }
          stream.getTracks().forEach(track => track.stop());
        }, 'image/jpeg', 0.9);
      }
    } catch {
      toast({ title: 'Could not access your camera. Please check your browser permissions.', status: 'error', duration: 5000, isClosable: true });
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
        setGenerationStatus(`Step ${idx + 1} of ${totalSteps}: Reading text from "${image.filename}"`);
        const result = await API.ocr.process({
          image_id: image.image_id, language: 'eng', enhance_image: false, use_mistral: true,
        }, sessionId || undefined);
        ocrTexts.push(result.text);
        ocrPreviews.push({ filename: image.filename, text: result.text });
      }

      setOcrPreviewTexts(ocrPreviews);
      const combinedText = ocrTexts.join('\n\n---\n\n');

      setGenerationStatus(
        formData.report_type === 'iep_progress_monitoring'
          ? `Step ${totalSteps} of ${totalSteps}: Writing your IEP progress monitoring report`
          : `Step ${totalSteps} of ${totalSteps}: Writing your progress report`
      );
      const result = await API.summary.generate({
        text: combinedText,
        template: 'maryland_qpr',
        report_type: formData.report_type,
        grade_level: formData.grade_level,
        subject: formData.subject,
        student_name: formData.student_name || undefined,
        teacher_name: formData.teacher_name || undefined,
        case_manager: formData.case_manager || undefined,
        school: formData.school || undefined,
        reporting_period: formData.reporting_period,
        include_standards: formData.include_standards,
        include_iep_goals: formData.include_iep_goals,
        include_behavioral: formData.include_behavioral,
      }, sessionId || undefined);

      addSummary(result);
      setSummaryText(result.summary_text);
      setGenerationStatus('');

      const reportId = `report_${Date.now()}`;
      addReportToHistory({
        id: reportId,
        createdAt: new Date().toISOString(),
        formData: { ...formData },
        summaryText: result.summary_text,
        ocrTexts: ocrPreviews,
        imageFilenames: images.map((img) => img.filename),
        modelUsed: result.model_used,
        processingTime: result.processing_time,
      });
      logEvent('REPORT_GENERATED', reportId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
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
      toast({ title: 'Report copied to clipboard. You can now paste it anywhere.', status: 'success', duration: 3000, isClosable: true });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePrint = () => setTimeout(() => window.print(), 100);

  const handleDownload = async () => {
    if (!summaryText) return;
    const filename = `progress_report_${formData.student_name || 'student'}_${Date.now()}.docx`;
    try {
      await downloadAsDocx(summaryText, filename);
      toast({ title: 'Word document downloaded. Check your Downloads folder.', status: 'success', duration: 4000, isClosable: true });
    } catch {
      toast({ title: 'Download failed. Please try again.', status: 'error', duration: 5000, isClosable: true });
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
    <Box maxW="960px" mx="auto" px={{ base: 4, md: 6 }} py={6} onClick={handleUserActivity}>
      <PrivacyConsentModal />
      <PrivacyBanner />
      <VStack spacing={5} align="stretch">

        {!viewingReport && (<>

        {/* Welcome / How It Works */}
        {isFirstVisit && (
          <Card variant="outline" bg="brand.50" borderColor="brand.200">
            <CardBody py={4}>
              <Text fontSize="md" fontWeight={700} color="brand.800" mb={2}>
                Welcome! This tool helps you create progress reports and IEP progress monitoring reports.
              </Text>
              <Text fontSize="sm" color="gray.700" lineHeight={1.7} mb={3}>
                Upload photos of student work or Goalbook IEP data collection sheets, fill in a few details,
                and this tool will read the data and write a complete report for you.
                You can then download it as a Word document, print it, or copy and paste it.
              </Text>
              <Flex
                align="center"
                cursor="pointer"
                onClick={() => setShowHowItWorks(!showHowItWorks)}
                _hover={{ color: 'brand.700' }}
              >
                <Icon as={FiInfo} color="brand.600" mr={2} boxSize={4} />
                <Text fontSize="sm" fontWeight={600} color="brand.600">
                  {showHowItWorks ? 'Hide details' : 'How does it work? (click to expand)'}
                </Text>
                <Icon as={showHowItWorks ? FiChevronUp : FiChevronDown} color="brand.500" ml={1} boxSize={4} />
              </Flex>
              {showHowItWorks && (
                <Box mt={3} pl={2} borderLeft="3px solid" borderColor="brand.300">
                  <VStack align="start" spacing={2} fontSize="sm" color="gray.700">
                    <Text><Text as="span" fontWeight={700} color="brand.700">Step 1:</Text> Take a photo of student work (a worksheet, test, writing sample, etc.) or select an image from your computer.</Text>
                    <Text><Text as="span" fontWeight={700} color="brand.700">Step 2:</Text> Fill in the student's name, grade, subject, and other details. Only the grade and subject are required.</Text>
                    <Text><Text as="span" fontWeight={700} color="brand.700">Step 3:</Text> Click "Generate Report." The tool will read the text from the image and write a progress report based on what it finds.</Text>
                    <Text><Text as="span" fontWeight={700} color="brand.700">Step 4:</Text> Review the report. You can download it as a Word document, print it, or copy the text. All reports are saved automatically so you can come back to them later.</Text>
                  </VStack>
                </Box>
              )}
            </CardBody>
          </Card>
        )}

        {/* Step 1: Upload */}
        <Card variant="outline">
          <CardBody>
            <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600" mb={1}>
              Step 1: Upload Student Work
            </Text>
            <Text fontSize="xs" color="gray.500" mb={3}>
              {formData.report_type === 'iep_progress_monitoring'
                ? 'Upload photos of Goalbook IEP data collection sheets. You can add multiple pages for the same student.'
                : 'Take a photo or upload an image of a worksheet, test, quiz, or writing sample. You can add multiple images for the same student.'}
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
              <Text fontSize="sm" color="gray.600" mb={1}>
                {isDragActive ? 'Drop your files here' : 'Drag and drop images here, or'}
              </Text>
              <Button size="sm" variant="outline" colorScheme="blue" onClick={open} isDisabled={upload.is_uploading}>
                Browse Files
              </Button>
              <Text fontSize="xs" color="gray.400" mt={2}>
                Accepts JPG, PNG, and WebP images up to 10MB each
              </Text>
            </Box>

            <Button
              leftIcon={<FiCamera />} size="xs" variant="ghost" color="gray.500"
              onClick={captureImage} isDisabled={upload.is_uploading}
            >
              Take Photo with Camera
            </Button>

            {upload.error && (
              <Alert status="error" borderRadius="md" mt={3} py={2}>
                <AlertIcon boxSize={4} />
                <AlertDescription fontSize="sm">{upload.error}</AlertDescription>
              </Alert>
            )}

            {images.length > 0 && (
              <>
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
                          aria-label="Remove this image"
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
                <Text fontSize="xs" color="gray.400" mt={2}>
                  {images.length} image{images.length !== 1 ? 's' : ''} ready. You can add more or remove any by clicking the X.
                </Text>
              </>
            )}

            {upload.is_uploading && (
              <Flex align="center" gap={2} mt={2}>
                <Spinner size="xs" color="brand.500" />
                <Text fontSize="xs" color="gray.500">Uploading your image...</Text>
              </Flex>
            )}
          </CardBody>
        </Card>

        {/* Step 2: Student Information */}
        <Card variant="outline">
          <CardBody>
            <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600" mb={1}>
              Step 2: Report Type & Student Information
            </Text>

            {/* Report Type Toggle */}
            <HStack spacing={2} mb={3}>
              <Button
                size="sm"
                variant={formData.report_type === 'iep_progress_monitoring' ? 'solid' : 'outline'}
                bg={formData.report_type === 'iep_progress_monitoring' ? 'brand.700' : undefined}
                color={formData.report_type === 'iep_progress_monitoring' ? 'white' : 'gray.600'}
                _hover={formData.report_type === 'iep_progress_monitoring' ? { bg: 'brand.800' } : { bg: 'gray.100' }}
                onClick={() => updateFormData({
                  report_type: 'iep_progress_monitoring',
                  include_iep_goals: true,
                  subject: IEP_GOAL_AREAS[0],
                })}
                fontWeight={600}
              >
                IEP Progress Monitoring
              </Button>
              <Button
                size="sm"
                variant={formData.report_type === 'general_ed' ? 'solid' : 'outline'}
                bg={formData.report_type === 'general_ed' ? 'brand.700' : undefined}
                color={formData.report_type === 'general_ed' ? 'white' : 'gray.600'}
                _hover={formData.report_type === 'general_ed' ? { bg: 'brand.800' } : { bg: 'gray.100' }}
                onClick={() => updateFormData({
                  report_type: 'general_ed',
                  include_iep_goals: false,
                  subject: MARYLAND_SUBJECTS[0],
                })}
                fontWeight={600}
              >
                General Education
              </Button>
            </HStack>

            <Text fontSize="xs" color="gray.500" mb={3}>
              {formData.report_type === 'iep_progress_monitoring'
                ? 'Upload photos of Goalbook data collection sheets. Fill in the student and case manager info below.'
                : 'Fill in what you know. Only the grade and subject are required -- the rest is optional but will make the report more specific.'}
            </Text>

            <Stack spacing={3} direction={{ base: 'column', md: 'row' }}>
              <FormControl>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Student Name</FormLabel>
                <Input
                  size="sm" borderColor="gray.300" _hover={{ borderColor: 'gray.400' }}
                  value={formData.student_name}
                  onChange={(e) => updateFormData({ student_name: e.target.value })}
                  placeholder="e.g. Sarah Chen"
                  autoComplete="one-time-code"
                  name="student_name_nofill"
                  data-lpignore="true"
                  data-form-type="other"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Grade</FormLabel>
                <Select size="sm" borderColor="gray.300" value={formData.grade_level} onChange={(e) => updateFormData({ grade_level: e.target.value })}>
                  {MARYLAND_GRADES.map((g: string) => <option key={g} value={g}>{g}</option>)}
                </Select>
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>
                  {formData.report_type === 'iep_progress_monitoring' ? 'Goal Area' : 'Subject'}
                </FormLabel>
                <Select size="sm" borderColor="gray.300" value={formData.subject} onChange={(e) => updateFormData({ subject: e.target.value })}>
                  {formData.report_type === 'iep_progress_monitoring'
                    ? IEP_GOAL_AREAS.map((g) => <option key={g} value={g}>{g}</option>)
                    : MARYLAND_SUBJECTS.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </FormControl>
            </Stack>

            <Divider my={3} borderColor="gray.200" />

            <Stack spacing={3} direction={{ base: 'column', md: 'row' }}>
              {formData.report_type === 'iep_progress_monitoring' ? (
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Case Manager</FormLabel>
                  <Input
                    size="sm" borderColor="gray.300" _hover={{ borderColor: 'gray.400' }}
                    value={formData.case_manager}
                    onChange={(e) => updateFormData({ case_manager: e.target.value })}
                    placeholder="e.g. Ms. Johnson"
                    autoComplete="one-time-code"
                    name="case_manager_nofill"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                </FormControl>
              ) : (
                <FormControl>
                  <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Teacher Name</FormLabel>
                  <Input
                    size="sm" borderColor="gray.300" _hover={{ borderColor: 'gray.400' }}
                    value={formData.teacher_name}
                    onChange={(e) => updateFormData({ teacher_name: e.target.value })}
                    placeholder="e.g. Ms. Rivera"
                    autoComplete="one-time-code"
                    name="teacher_name_nofill"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                </FormControl>
              )}
              <FormControl>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>School</FormLabel>
                <Input
                  size="sm" borderColor="gray.300" _hover={{ borderColor: 'gray.400' }}
                  value={formData.school}
                  onChange={(e) => updateFormData({ school: e.target.value })}
                  placeholder="e.g. Parkview Elementary"
                  autoComplete="one-time-code"
                  name="school_nofill"
                  data-lpignore="true"
                  data-form-type="other"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" color="gray.600" fontWeight={600} mb={1}>Reporting Period</FormLabel>
                <Select size="sm" borderColor="gray.300" value={formData.reporting_period} onChange={(e) => updateFormData({ reporting_period: e.target.value })}>
                  {REPORTING_PERIODS.map((p: string) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </FormControl>
            </Stack>

            <Divider my={3} borderColor="gray.200" />

            <Text fontSize="xs" color="gray.500" mb={2}>
              Check the boxes below to include additional sections in the report:
            </Text>
            <HStack spacing={5}>
              {formData.report_type === 'general_ed' && (
                <Checkbox size="sm" colorScheme="blue" isChecked={formData.include_standards} onChange={(e) => updateFormData({ include_standards: e.target.checked })}>
                  <Text fontSize="xs" color="gray.600">Maryland Standards</Text>
                </Checkbox>
              )}
              {formData.report_type === 'general_ed' && (
                <Checkbox size="sm" colorScheme="blue" isChecked={formData.include_iep_goals} onChange={(e) => updateFormData({ include_iep_goals: e.target.checked })}>
                  <Text fontSize="xs" color="gray.600">IEP Goals</Text>
                </Checkbox>
              )}
              <Checkbox size="sm" colorScheme="blue" isChecked={formData.include_behavioral} onChange={(e) => updateFormData({ include_behavioral: e.target.checked })}>
                <Text fontSize="xs" color="gray.600">Behavioral Notes</Text>
              </Checkbox>
            </HStack>
          </CardBody>
        </Card>

        {/* Step 3: Generate */}
        <Box>
          <Button
            bg="brand.700"
            color="white"
            _hover={{ bg: 'brand.800' }}
            _active={{ bg: 'brand.900' }}
            size="lg"
            w="100%"
            onClick={generateReport}
            isLoading={isGenerating}
            loadingText={generationStatus || 'Working on it...'}
            isDisabled={images.length === 0 || upload.is_uploading}
            fontWeight={600}
            letterSpacing="0.01em"
          >
            {images.length === 0
              ? 'Upload an Image First'
              : formData.report_type === 'iep_progress_monitoring'
                ? 'Generate IEP Progress Report'
                : 'Generate Progress Report'}
          </Button>
          {images.length === 0 && !summaryText && (
            <Text fontSize="xs" color="gray.400" textAlign="center" mt={2}>
              Upload at least one image of student work above to get started.
            </Text>
          )}
          {isGenerating && (
            <Text fontSize="xs" color="gray.500" textAlign="center" mt={2}>
              This usually takes 15-30 seconds. Please don't close this page.
            </Text>
          )}
        </Box>

        {/* Error */}
        {error && (
          <Alert status="error" borderRadius="md" py={3}>
            <AlertIcon boxSize={4} />
            <AlertDescription fontSize="sm">
              {error}
              <Text fontSize="xs" color="gray.500" mt={1}>
                If this keeps happening, try refreshing the page or uploading a clearer image.
              </Text>
            </AlertDescription>
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
                    What We Read From Your Image
                  </Text>
                  <Badge colorScheme="blue" fontSize="2xs" variant="subtle">
                    {ocrPreviewTexts.length} image{ocrPreviewTexts.length !== 1 ? 's' : ''}
                  </Badge>
                </HStack>
                <Icon as={showOcrPreview ? FiChevronUp : FiChevronDown} color="gray.400" boxSize={4} />
              </Flex>
              {!showOcrPreview && (
                <Text fontSize="xs" color="gray.400" mt={1}>
                  Click to see the text that was extracted from your image{ocrPreviewTexts.length !== 1 ? 's' : ''}. This is what the report is based on.
                </Text>
              )}

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

        {/* Step 4: Report Output */}
        {summaryText && (
          <Card variant="outline">
            <CardBody>
              <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600" mb={1}>
                Your Progress Report
              </Text>
              <Text fontSize="xs" color="gray.500" mb={3}>
                Review the report below. You can copy it, print it, or download it as a Word document.
                This report has been saved automatically -- you can find it in "Past Reports" at the bottom of the page.
              </Text>

              <Flex justify="flex-end" mb={3} flexWrap="wrap" gap={1}>
                <Button
                  leftIcon={copied ? <FiCheck /> : <FiCopy />}
                  size="sm" variant="outline" colorScheme={copied ? 'green' : 'gray'}
                  onClick={copyToClipboard}
                >
                  {copied ? 'Copied!' : 'Copy Text'}
                </Button>
                <Button leftIcon={<FiPrinter />} size="sm" variant="outline" colorScheme="gray" onClick={handlePrint}>
                  Print
                </Button>
                <Button leftIcon={<FiDownload />} size="sm" variant="outline" colorScheme="blue" onClick={handleDownload}>
                  Download Word Doc
                </Button>
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

        {/* Start another report */}
        {summaryText && (
          <Flex justify="center" pb={4}>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={handleStartOver}
              size="sm"
              variant="outline"
              colorScheme="gray"
            >
              Start a New Report for Another Student
            </Button>
          </Flex>
        )}
        </>)}

        {/* Viewing a past report */}
        {viewingReport && (
          <>
            <Flex align="center" mb={2}>
              <Button
                leftIcon={<FiArrowLeft />}
                size="sm"
                variant="ghost"
                color="gray.500"
                onClick={() => setViewingReport(null)}
                _hover={{ color: 'brand.600' }}
              >
                Back to Report Generator
              </Button>
            </Flex>

            <Card variant="outline" mb={3}>
              <CardBody py={3}>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600">
                    Saved Report
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    Created {new Date(viewingReport.createdAt).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </Text>
                </Flex>
                <SimpleGrid columns={{ base: 2, md: 3 }} spacing={2} fontSize="xs" color="gray.600">
                  {viewingReport.formData.report_type === 'iep_progress_monitoring' && (
                    <Text><Text as="span" fontWeight={600}>Type:</Text> IEP Progress Monitoring</Text>
                  )}
                  {viewingReport.formData.student_name && (
                    <Text><Text as="span" fontWeight={600}>Student:</Text> {viewingReport.formData.student_name}</Text>
                  )}
                  <Text><Text as="span" fontWeight={600}>Grade:</Text> {viewingReport.formData.grade_level}</Text>
                  <Text>
                    <Text as="span" fontWeight={600}>
                      {viewingReport.formData.report_type === 'iep_progress_monitoring' ? 'Goal Area:' : 'Subject:'}
                    </Text>{' '}
                    {viewingReport.formData.subject}
                  </Text>
                  {viewingReport.formData.case_manager && (
                    <Text><Text as="span" fontWeight={600}>Case Manager:</Text> {viewingReport.formData.case_manager}</Text>
                  )}
                  {viewingReport.formData.teacher_name && (
                    <Text><Text as="span" fontWeight={600}>Teacher:</Text> {viewingReport.formData.teacher_name}</Text>
                  )}
                  {viewingReport.formData.school && (
                    <Text><Text as="span" fontWeight={600}>School:</Text> {viewingReport.formData.school}</Text>
                  )}
                  <Text><Text as="span" fontWeight={600}>Period:</Text> {viewingReport.formData.reporting_period}</Text>
                </SimpleGrid>
                {viewingReport.imageFilenames.length > 0 && (
                  <Text fontSize="xs" color="gray.400" mt={2}>
                    Based on: {viewingReport.imageFilenames.join(', ')}
                  </Text>
                )}
              </CardBody>
            </Card>

            {viewingReport.ocrTexts.length > 0 && (
              <Card variant="outline" mb={3}>
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
                        {viewingReport.ocrTexts.length} image{viewingReport.ocrTexts.length !== 1 ? 's' : ''}
                      </Badge>
                    </HStack>
                    <Icon as={showOcrPreview ? FiChevronUp : FiChevronDown} color="gray.400" boxSize={4} />
                  </Flex>
                  {showOcrPreview && (
                    <VStack spacing={3} align="stretch" mt={3}>
                      {viewingReport.ocrTexts.map((ocr, idx) => (
                        <Box key={idx}>
                          {viewingReport.ocrTexts.length > 1 && (
                            <Text fontSize="xs" fontWeight={600} color="gray.500" mb={1}>{ocr.filename}</Text>
                          )}
                          <Box bg="gray.50" p={4} borderRadius="md" maxH="300px" overflowY="auto" fontSize="sm" border="1px solid" borderColor="gray.200" sx={markdownStyles}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{ocr.text}</ReactMarkdown>
                          </Box>
                        </Box>
                      ))}
                    </VStack>
                  )}
                </CardBody>
              </Card>
            )}

            <Card variant="outline">
              <CardBody>
                <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600" mb={3}>
                  Progress Report
                </Text>
                <Flex justify="flex-end" mb={3} gap={1}>
                  <Button
                    leftIcon={<FiCopy />} size="sm" variant="outline" colorScheme="gray"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingReport.summaryText);
                      toast({ title: 'Report copied to clipboard.', status: 'success', duration: 3000, isClosable: true });
                    }}
                  >
                    Copy Text
                  </Button>
                  <Button leftIcon={<FiDownload />} size="sm" variant="outline" colorScheme="blue"
                    onClick={async () => {
                      const fn = `progress_report_${viewingReport.formData.student_name || 'student'}_${Date.now()}.docx`;
                      await downloadAsDocx(viewingReport.summaryText, fn);
                      toast({ title: 'Word document downloaded.', status: 'success', duration: 3000, isClosable: true });
                    }}
                  >
                    Download Word Doc
                  </Button>
                </Flex>
                <Box className="report-output" p={5} borderRadius="md" border="1px solid" borderColor="gray.200" bg="white" fontSize="sm" sx={markdownStyles}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewingReport.summaryText}</ReactMarkdown>
                </Box>
              </CardBody>
            </Card>
          </>
        )}

        {/* Report History */}
        {reportHistory.length > 0 && !viewingReport && (
          <Card variant="outline">
            <CardBody py={3}>
              <Flex
                justify="space-between"
                align="center"
                cursor="pointer"
                onClick={() => setShowHistory(!showHistory)}
                _hover={{ color: 'brand.600' }}
              >
                <HStack spacing={2}>
                  <Icon as={FiClock} color="gray.400" boxSize={4} />
                  <Text fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="0.08em" color="brand.600">
                    Past Reports
                  </Text>
                  <Badge colorScheme="gray" fontSize="2xs" variant="subtle">
                    {reportHistory.length}
                  </Badge>
                </HStack>
                <Icon as={showHistory ? FiChevronUp : FiChevronDown} color="gray.400" boxSize={4} />
              </Flex>
              {!showHistory && (
                <Text fontSize="xs" color="gray.400" mt={1}>
                  Click to see reports you've created before. You can view, download, or delete them.
                </Text>
              )}

              {showHistory && (
                <VStack spacing={2} align="stretch" mt={3}>
                  {reportHistory.map((report) => (
                    <Flex
                      key={report.id}
                      align="center"
                      justify="space-between"
                      p={3}
                      bg="gray.50"
                      borderRadius="md"
                      border="1px solid"
                      borderColor="gray.200"
                      cursor="pointer"
                      _hover={{ bg: 'gray.100', borderColor: 'brand.300' }}
                      onClick={() => { setViewingReport(report); setShowOcrPreview(false); }}
                    >
                      <Box flex={1}>
                        <Text fontSize="sm" fontWeight={600} color="gray.700" noOfLines={1}>
                          {report.formData.student_name || 'Unnamed Student'}
                          <Text as="span" fontWeight={400} color="gray.500">
                            {' -- '}{report.formData.subject}, Grade {report.formData.grade_level}
                            {report.formData.report_type === 'iep_progress_monitoring' && ' (IEP)'}
                          </Text>
                        </Text>
                        <Text fontSize="xs" color="gray.400">
                          {new Date(report.createdAt).toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
                          })}
                          {' -- '}{report.imageFilenames.length} image{report.imageFilenames.length !== 1 ? 's' : ''}
                        </Text>
                      </Box>
                      <IconButton
                        aria-label="Delete this report"
                        icon={<FiTrash2 />}
                        size="xs"
                        variant="ghost"
                        color="gray.400"
                        _hover={{ color: 'red.500' }}
                        onClick={(e) => { e.stopPropagation(); removeReportFromHistory(report.id); logEvent('REPORT_DELETED', report.id); }}
                      />
                    </Flex>
                  ))}
                </VStack>
              )}
            </CardBody>
          </Card>
        )}

        {/* Clear All My Data */}
        {!viewingReport && (
          <Flex justify="center" pt={2} pb={2}>
            <Button
              leftIcon={<FiAlertTriangle />}
              size="xs"
              variant="outline"
              colorScheme="red"
              onClick={onClearDialogOpen}
            >
              Clear All My Data
            </Button>
          </Flex>
        )}

        {/* Clear Data Confirmation Dialog */}
        <AlertDialog
          isOpen={isClearDialogOpen}
          leastDestructiveRef={clearDialogCancelRef}
          onClose={onClearDialogClose}
          isCentered
        >
          <AlertDialogOverlay>
            <AlertDialogContent mx={4}>
              <AlertDialogHeader fontSize="md" fontWeight={700} color="gray.800">
                Clear All Data
              </AlertDialogHeader>

              <AlertDialogBody>
                <Text fontSize="sm" color="gray.600" lineHeight={1.7}>
                  This will permanently delete all your data, including saved reports,
                  uploaded images, and form entries. This cannot be undone.
                </Text>
              </AlertDialogBody>

              <AlertDialogFooter gap={2}>
                <Button
                  ref={clearDialogCancelRef}
                  onClick={onClearDialogClose}
                  size="sm"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  colorScheme="red"
                  onClick={handleClearAllData}
                  size="sm"
                >
                  Delete Everything
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>

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
