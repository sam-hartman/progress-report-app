// Header component with app title
import { Box, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react';

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
          Quarterly Progress Report Notes
        </Heading>
        <Text fontSize="md" opacity={0.9}>
          Maryland Public School System
        </Text>
      </Flex>
    </Box>
  );
}

export default Header;
