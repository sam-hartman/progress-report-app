import { useState, useCallback } from 'react';
import {
  Box,
  Flex,
  Text,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  List,
  ListItem,
  ListIcon,
  Link,
} from '@chakra-ui/react';
import { FiX, FiShield } from 'react-icons/fi';
import { useAppStore } from '../stores/appStore';

const PRIVACY_BULLETS = [
  'Student names and information are encrypted in your browser',
  'Photos are sent to a secure server for text recognition, then deleted within 24 hours',
  'Text is processed by an AI service with Zero Data Retention \u2014 your data is not stored or used for training',
  'Reports are saved in your browser for up to 90 days, then automatically removed',
] as const;

function PrivacyBanner() {
  const [dismissed, setDismissed] = useState(false);
  const privacyConsent = useAppStore((state) => state.privacyConsent);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Only show if consent has been given and not dismissed this session
  if (!privacyConsent || dismissed) {
    return null;
  }

  return (
    <Box
      bg="blue.50"
      borderBottom="1px solid"
      borderColor="blue.100"
      px={{ base: 4, md: 6 }}
      py={2}
      maxW="960px"
      mx="auto"
      borderRadius="md"
      mb={2}
    >
      <Flex align="center" justify="space-between" gap={2}>
        <Flex align="center" gap={2} flex={1} minW={0}>
          <FiShield
            color="var(--chakra-colors-blue-400)"
            style={{ flexShrink: 0 }}
            size={14}
          />
          <Text fontSize="xs" color="gray.600" noOfLines={1}>
            Your data is encrypted and processed with privacy protections.
          </Text>
          <Popover placement="bottom-start" isLazy>
            <PopoverTrigger>
              <Link
                fontSize="xs"
                color="blue.500"
                fontWeight={600}
                flexShrink={0}
                _hover={{ color: 'blue.600', textDecoration: 'underline' }}
                cursor="pointer"
              >
                Learn more
              </Link>
            </PopoverTrigger>
            <PopoverContent
              w={{ base: '300px', md: '380px' }}
              shadow="lg"
              borderColor="blue.100"
            >
              <PopoverArrow />
              <PopoverCloseButton size="sm" />
              <PopoverBody py={4} px={4}>
                <Text
                  fontSize="xs"
                  fontWeight={700}
                  color="gray.700"
                  mb={3}
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  How your data is protected
                </Text>
                <List spacing={2}>
                  {PRIVACY_BULLETS.map((bullet) => (
                    <ListItem
                      key={bullet}
                      fontSize="xs"
                      color="gray.600"
                      lineHeight={1.5}
                      display="flex"
                      alignItems="flex-start"
                    >
                      <ListIcon
                        as={FiShield}
                        color="blue.400"
                        mt="2px"
                        flexShrink={0}
                      />
                      {bullet}
                    </ListItem>
                  ))}
                </List>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </Flex>

        <IconButton
          aria-label="Dismiss privacy banner"
          icon={<FiX />}
          size="xs"
          variant="ghost"
          color="gray.400"
          _hover={{ color: 'gray.600' }}
          onClick={handleDismiss}
          flexShrink={0}
        />
      </Flex>
    </Box>
  );
}

export default PrivacyBanner;
