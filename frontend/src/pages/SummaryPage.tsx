// Summary generation page
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
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
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
} from '@chakra-ui/react';
import { 
  FiArrowLeft, 
  FiFileText, 
  FiCopy, 
  FiCheck, 
  FiPrinter,
  FiDownload 
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { API } from '../utils/api';
import {
  useOCR,
  useSummary,
  useFormData,
  useSession,
  MARYLAND_GRADES,
  MARYLAND_SUBJECTS,
  REPORTING_PERIODS,
} from '../stores/appStore';

function SummaryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summaryText, setSummaryText] = useState('');
  const [copied, setCopied] = useState(false);
  const [_isPrinting, setIsPrinting] = useState(false);
  
  const { ocrResults } = useOCR();
  const { summary, addSummary, setSummaryState } = useSummary();
  const { formData, updateFormData } = useFormData();
  const { sessionId } = useSession();
  
  // Get OCR text
  const getOCRText = () => {
    if (Object.keys(ocrResults).length === 0) return '';
    const firstResult = Object.values(ocrResults)[0];
    return firstResult?.text || '';
  };
  
  // Generate summary
  const generateSummary = async () => {
    const text = getOCRText();
    
    if (!text) {
      toast({
        title: 'No OCR text',
        description: 'Please process OCR first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsGenerating(true);
    setProgress(0);
    setSummaryState({ is_generating: true, error: null });

    // Simulate progress — declared outside try/catch so catch can clear it
    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + 8, 88));
    }, 200);

    try {
      const result = await API.summary.generate({
        text,
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

      clearInterval(interval);
      setProgress(100);

      addSummary(result);
      setSummaryText(result.summary_text);

      setSummaryState({ is_generating: false, error: null });
      setIsGenerating(false);

      toast({
        title: 'Summary generated',
        description: `Report generated using ${result.model_used}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error) {
      clearInterval(interval);
      setIsGenerating(false);
      setSummaryState({ 
        is_generating: false, 
        error: error instanceof Error ? error.message : 'Summary generation failed' 
      });
      
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate summary',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Auto-generate summary when page loads
  useEffect(() => {
    if (summaryText === '' && getOCRText()) {
      generateSummary();
    }
  }, [summaryText, ocrResults, formData]);
  
  // Copy to clipboard
  const copyToClipboard = () => {
    if (!summaryText) return;
    
    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true);
      toast({
        title: 'Copied',
        description: 'Summary copied to clipboard',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy summary',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    });
  };
  
  // Print summary
  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };
  
  // Download summary
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
    
    toast({
      title: 'Downloaded',
      description: 'Summary downloaded as text file',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };
  
  // Go back
  const handleBack = () => {
    navigate('/tables');
  };
  
  // Start over
  const handleStartOver = () => {
    navigate('/upload');
  };
  
  return (
    <VStack spacing={6} align="stretch">
      {/* Page Header */}
      <Box textAlign="center">
        <Heading as="h2" size="lg" mb={2}>
          Generate Progress Report
        </Heading>
        <Text color="gray.600">
          Create a structured quarterly progress report for Maryland public schools
        </Text>
      </Box>
      
      {/* Error Alert */}
      {summary.error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Generation Error</AlertTitle>
            <AlertDescription>{summary.error}</AlertDescription>
          </Box>
        </Alert>
      )}
      
      {/* Student Information Form */}
      <Card>
        <CardHeader>
          <Text fontWeight="bold">Student Information</Text>
        </CardHeader>
        <CardBody>
          <Stack spacing={4} direction={{ base: 'column', md: 'row' }}>
            <FormControl>
              <FormLabel>Student Name</FormLabel>
              <Input 
                value={formData.student_name} 
                onChange={(e) => updateFormData({ student_name: e.target.value })}
                placeholder="Enter student name"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Grade Level</FormLabel>
              <Select 
                value={formData.grade_level} 
                onChange={(e) => updateFormData({ grade_level: e.target.value })}
              >
                {MARYLAND_GRADES.map((grade: string) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Subject</FormLabel>
              <Select 
                value={formData.subject} 
                onChange={(e) => updateFormData({ subject: e.target.value })}
              >
                {MARYLAND_SUBJECTS.map((subject: string) => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </Select>
            </FormControl>
          </Stack>
          
          <Divider my={4} />
          
          <Stack spacing={4} direction={{ base: 'column', md: 'row' }}>
            <FormControl>
              <FormLabel>Teacher Name</FormLabel>
              <Input 
                value={formData.teacher_name} 
                onChange={(e) => updateFormData({ teacher_name: e.target.value })}
                placeholder="Enter teacher name"
              />
            </FormControl>
            <FormControl>
              <FormLabel>School</FormLabel>
              <Input 
                value={formData.school} 
                onChange={(e) => updateFormData({ school: e.target.value })}
                placeholder="Enter school name"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Reporting Period</FormLabel>
              <Select 
                value={formData.reporting_period} 
                onChange={(e) => updateFormData({ reporting_period: e.target.value })}
              >
                {REPORTING_PERIODS.map((period: string) => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </Select>
            </FormControl>
          </Stack>
          
          <Divider my={4} />
          
          <Stack spacing={4} direction="row">
            <Checkbox 
              isChecked={formData.include_standards} 
              onChange={(e) => updateFormData({ include_standards: e.target.checked })}
            >
              Include Maryland Standards
            </Checkbox>
            <Checkbox 
              isChecked={formData.include_iep_goals} 
              onChange={(e) => updateFormData({ include_iep_goals: e.target.checked })}
            >
              Include IEP Goals
            </Checkbox>
            <Checkbox 
              isChecked={formData.include_behavioral} 
              onChange={(e) => updateFormData({ include_behavioral: e.target.checked })}
            >
              Include Behavioral Notes
            </Checkbox>
          </Stack>
        </CardBody>
      </Card>
      
      {/* Generate Button */}
      <Button 
        colorScheme="blue" 
        onClick={generateSummary} 
        isLoading={isGenerating || summary.is_generating}
        isDisabled={!getOCRText()}
        size="lg"
        leftIcon={isGenerating ? <Spinner size="sm" /> : <FiFileText />}
      >
        {isGenerating ? 'Generating...' : 'Generate Progress Report'}
      </Button>
      
      {/* Progress Bar */}
      {(isGenerating || summary.is_generating) && (
        <Box>
          <Box 
            h="4px" 
            bg="gray.200" 
            borderRadius="full" 
            overflow="hidden"
          >
            <Box 
              h="100%" 
              bg="blue.500" 
              w={`${progress}%`}
              transition="width 0.3s"
            />
          </Box>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Generating: {progress}%
          </Text>
        </Box>
      )}
      
      {/* Summary Output */}
      {summaryText && (
        <Card>
          <CardHeader 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center"
            flexWrap="wrap"
            gap={2}
          >
            <Text fontWeight="bold">Generated Progress Report</Text>
            <Flex gap={2}>
              <Button 
                leftIcon={copied ? <FiCheck /> : <FiCopy />} 
                size="sm" 
                onClick={copyToClipboard}
                colorScheme={copied ? 'green' : 'gray'}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button 
                leftIcon={<FiPrinter />} 
                size="sm" 
                onClick={handlePrint}
                colorScheme="gray"
              >
                Print
              </Button>
              <Button 
                leftIcon={<FiDownload />} 
                size="sm" 
                onClick={handleDownload}
                colorScheme="gray"
              >
                Download
              </Button>
            </Flex>
          </CardHeader>
          <CardBody>
            <Box
              className="summary-output"
              whiteSpace="pre-wrap"
              overflowWrap="break-word"
              fontSize="md"
              lineHeight="1.7"
              p={4}
              borderRadius="md"
              border="1px solid"
              borderColor="gray.200"
            >
              {summaryText}
            </Box>
          </CardBody>
        </Card>
      )}
      
      {/* Navigation Buttons */}
      <Flex justify="space-between" align="center" w="full">
        <Button 
          colorScheme="gray" 
          onClick={handleBack}
          leftIcon={<FiArrowLeft />}
        >
          Back
        </Button>
        <Button 
          colorScheme="gray" 
          onClick={handleStartOver}
          variant="outline"
        >
          Start Over
        </Button>
      </Flex>
      
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .maryland-header {
            position: static !important;
          }
          .mobile-nav {
            display: none !important;
          }
        }
      `}</style>
    </VStack>
  );
}

export default SummaryPage;
