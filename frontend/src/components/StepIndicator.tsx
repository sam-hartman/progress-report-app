// Step indicator component showing the current workflow step
import { Box, Flex, Text } from '@chakra-ui/react';

interface StepIndicatorProps {
  currentStep: 'upload' | 'ocr' | 'tables' | 'summary';
}

const steps = [
  { id: 'upload', label: 'Upload', number: 1 },
  { id: 'ocr', label: 'OCR', number: 2 },
  { id: 'tables', label: 'Tables', number: 3 },
  { id: 'summary', label: 'Summary', number: 4 },
];

function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <Box className="steps" my={4}>
      {steps.map((step, index) => (
        <Flex 
          key={step.id} 
          className={`step ${step.id === currentStep ? 'active' : ''}`}
          direction="column" 
          align="center"
          gap={1}
        >
          <Box 
            className={`step-number ${step.id === currentStep ? 'active' : ''} ${
              steps.indexOf(steps.find(s => s.id === currentStep)!) > index 
                ? 'completed' 
                : ''
            }`}
            display="flex"
            alignItems="center"
            justifyContent="center"
            w={8}
            h={8}
            borderRadius="full"
            fontWeight={600}
            fontSize="sm"
          >
            {step.number}
          </Box>
          <Text 
            className="step-label" 
            fontSize="xs" 
            color="gray.500"
            textAlign="center"
          >
            {step.label}
          </Text>
          {index < steps.length - 1 && (
            <Box 
              className="step-connector" 
              w={10} 
              h="1px" 
              bg="gray.200"
              mx={2}
            />
          )}
        </Flex>
      ))}
    </Box>
  );
}

export default StepIndicator;
