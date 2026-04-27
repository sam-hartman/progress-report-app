// Header component with app title and branding
import { Box, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

function Header() {
  const bgColor = useColorModeValue('maryland.blue', 'gray.800');
  const textColor = useColorModeValue('white', 'whiteAlpha.900');
  
  return (
    <Box 
      as="header" 
      className="maryland-header"
      bg={bgColor}
      color={textColor}
      position="sticky"
      top={0}
      zIndex={100}
    >
      <Flex 
        direction="column" 
        align="center" 
        justify="center"
        maxW="1200px" 
        mx="auto"
        px={4}
        py={4}
      >
        <Heading as="h1" size="xl" fontWeight={700}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            Quarterly Progress Report Notes
          </Link>
        </Heading>
        <Text fontSize="md" opacity={0.9}>
          Maryland Public School System
        </Text>
      </Flex>
    </Box>
  );
}

export default Header;
