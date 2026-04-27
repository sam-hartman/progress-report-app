// Header component
import { Box, Flex, Heading, Text } from '@chakra-ui/react';

function Header() {
  return (
    <Box
      as="header"
      className="maryland-header no-print"
      bg="maryland.navy"
      color="white"
      position="sticky"
      top={0}
      zIndex={100}
      borderBottom="3px solid"
      borderColor="maryland.gold"
    >
      <Flex
        align="center"
        justify="space-between"
        maxW="960px"
        mx="auto"
        px={6}
        py={3}
      >
        <Box>
          <Heading as="h1" size="md" fontWeight={700} letterSpacing="-0.02em" color="white">
            Quarterly Progress Report
          </Heading>
          <Text fontSize="xs" opacity={0.7} fontWeight={500} textTransform="uppercase" letterSpacing="0.05em">
            Maryland Public School System
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}

export default Header;
