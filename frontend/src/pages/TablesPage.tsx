"""
Tables extraction and selection page
"""
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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Checkbox,
  Stack,
  Icon,
  Badge
} from '@chakra-ui/react';
import { FiArrowLeft, FiArrowRight, FiTable, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { API } from '../utils/api';
import { useOCR, useTables, useNavigation } from '../stores/appStore';

function TablesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  
  const { ocrResults, ocr } = useOCR();
  const { 
    extractedTables, 
    selectedTableIds, 
    setExtractedTables, 
    setSelectedTableIds,
    toggleTableSelection 
  } = useTables();
  const { goToSummary } = useNavigation();
  
  // Get OCR text for extraction
  const getOCRText = () => {
    if (Object.keys(ocrResults).length === 0) return '';
    // Get the first OCR result
    const firstResult = Object.values(ocrResults)[0];
    return firstResult?.text || '';
  };
  
  // Extract tables from OCR text
  const extractTables = async () => {
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
    
    setIsExtracting(true);
    setExtractionProgress(0);
    
    try {
      // Simulate progress
      const interval = setInterval(() => {
        setExtractionProgress(prev => Math.min(prev + 15, 85));
      }, 150);
      
      const result = await API.table.extract({
        text,
        min_confidence: 0.6,
      });
      
      clearInterval(interval);
      setExtractionProgress(100);
      
      setExtractedTables(result.tables);
      setIsExtracting(false);
      
      toast({
        title: 'Tables extracted',
        description: `Found ${result.tables.length} table(s) in the text`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
    } catch (error) {
      clearInterval(interval);
      setIsExtracting(false);
      
      toast({
        title: 'Extraction failed',
        description: error instanceof Error ? error.message : 'Failed to extract tables',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Auto-extract tables when page loads
  useEffect(() => {
    if (extractedTables.length === 0 && getOCRText()) {
      extractTables();
    }
  }, [extractedTables.length, ocrResults]);
  
  // Select all tables
  const selectAllTables = () => {
    if (extractedTables.length === 0) return;
    const allIds = extractedTables.map(table => table.id);
    setSelectedTableIds(allIds);
  };
  
  // Deselect all tables
  const deselectAllTables = () => {
    setSelectedTableIds([]);
  };
  
  // Get selected tables
  const getSelectedTables = () => {
    return extractedTables.filter(table => selectedTableIds.includes(table.id));
  };
  
  // Continue to summary
  const handleContinue = () => {
    goToSummary();
    navigate('/summary');
  };
  
  // Go back
  const handleBack = () => {
    navigate('/ocr');
  };
  
  return (
    <VStack spacing={6} align="stretch">
      {/* Page Header */}
      <Box textAlign="center">
        <Heading as="h2" size="lg" mb={2}>
          Table Extraction
        </Heading>
        <Text color="gray.600">
          Identify and select tables from the extracted text
        </Text>
      </Box>
      
      {/* Extract Button */}
      {extractedTables.length === 0 && (
        <Button 
          colorScheme="blue" 
          onClick={extractTables} 
          isLoading={isExtracting || ocr.is_processing}
          isDisabled={!getOCRText()}
          size="lg"
          leftIcon={isExtracting ? <Spinner size="sm" /> : <FiTable />}
        >
          {isExtracting ? 'Extracting...' : 'Extract Tables'}
        </Button>
      )}
      
      {/* Progress Bar */}
      {isExtracting && (
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
              w={`${extractionProgress}%`}
              transition="width 0.3s"
            />
          </Box>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Extracting: {extractionProgress}%
          </Text>
        </Box>
      )}
      
      {/* Table Selection Actions */}
      {extractedTables.length > 0 && (
        <Flex justify="space-between" align="center" w="full">
          <Flex gap={2}>
            <Button 
              leftIcon={<FiCheckSquare />} 
              onClick={selectAllTables}
              size="sm"
            >
              Select All
            </Button>
            <Button 
              leftIcon={<FiSquare />} 
              onClick={deselectAllTables}
              size="sm"
              variant="ghost"
            >
              Clear
            </Button>
          </Flex>
          <Badge colorScheme="blue">
            {selectedTableIds.length} of {extractedTables.length} selected
          </Badge>
        </Flex>
      )}
      
      {/* Extracted Tables */}
      {extractedTables.length > 0 && (
        <VStack spacing={4} align="stretch">
          {extractedTables.map((table, index) => {
            const isSelected = selectedTableIds.includes(table.id);
            
            return (
              <Card key={table.id} variant={isSelected ? 'outline' : 'solid'}> 
                <CardHeader 
                  display="flex" 
                  justifyContent="space-between" 
                  alignItems="center"
                  cursor="pointer"
                  onClick={() => toggleTableSelection(table.id)}
                >
                  <Flex align="center" gap={2}>
                    <Checkbox 
                      isChecked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleTableSelection(table.id);
                      }}
                    />
                    <Text fontWeight="bold">
                      Table {index + 1}
                    </Text>
                    <Badge colorScheme="green">
                      {Math.round(table.confidence * 100)}% confidence
                    </Badge>
                  </Flex>
                </CardHeader>
                <CardBody>
                  <Box className="table-container">
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          {table.headers.map((header, i) => (
                            <Th key={i}>{header || `Column ${i + 1}`}</Th>
                          ))}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {table.rows.map((row, rowIndex) => (
                          <Tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <Td key={cellIndex}>{cell}</Td>
                            ))}
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </CardBody>
              </Card>
            );
          })}
        </VStack>
      )}
      
      {/* No tables found */}
      {extractedTables.length === 0 && !isExtracting && getOCRText() && (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>No tables found</AlertTitle>
            <AlertDescription>
              No tabular data was detected in the extracted text. 
              You can still proceed to generate a summary.
            </AlertDescription>
          </Box>
        </Alert>
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
          colorScheme="blue" 
          onClick={handleContinue}
          rightIcon={<FiArrowRight />}
        >
          Continue to Summary
        </Button>
      </Flex>
    </VStack>
  );
}

export default TablesPage;
