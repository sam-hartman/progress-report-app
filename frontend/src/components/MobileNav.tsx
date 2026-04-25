"""
Mobile navigation component for bottom tab navigation
"""
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { FiUpload, FiFileText, FiTable, FiFile } from 'react-icons/fi';

interface MobileNavProps {
  currentStep: 'upload' | 'ocr' | 'tables' | 'summary';
}

const navItems = [
  { path: '/upload', step: 'upload', icon: FiUpload, label: 'Upload' },
  { path: '/ocr', step: 'ocr', icon: FiFileText, label: 'OCR' },
  { path: '/tables', step: 'tables', icon: FiTable, label: 'Tables' },
  { path: '/summary', step: 'summary', icon: FiFile, label: 'Summary' },
];

function MobileNav({ currentStep }: MobileNavProps) {
  const location = useLocation();
  
  return (
    <Box 
      className="mobile-nav" 
      position="fixed" 
      bottom={0} 
      left={0} 
      right={0} 
      bg="white" 
      borderTop="1px solid" 
      borderColor="gray.200"
      p={2}
      zIndex={1000}
    >
      <Flex justify="space-around" align="center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || currentStep === item.step;
          return (
            <Button 
              key={item.path}
              as={Link}
              to={item.path}
              className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
              variant="ghost"
              colorScheme={isActive ? 'blue' : 'gray'}
              display="flex"
              flexDirection="column"
              gap={1}
              p={2}
            >
              <Box as={item.icon} fontSize="1.5rem" />
              <Text fontSize="0.625rem" textTransform="uppercase" letterSpacing="0.5px">
                {item.label}
              </Text>
            </Button>
          );
        })}
      </Flex>
    </Box>
  );
}

export default MobileNav;
