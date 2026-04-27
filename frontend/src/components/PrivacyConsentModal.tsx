import { useCallback } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  List,
  ListItem,
  ListIcon,
  Box,
} from '@chakra-ui/react';
import { FiShield } from 'react-icons/fi';
import { useAppStore } from '../stores/appStore';
import { logEvent } from '../utils/auditLog';

const PRIVACY_BULLETS = [
  'Student names and information you enter are encrypted in your browser',
  'Photos are sent to a secure server for text recognition, then automatically deleted within 24 hours',
  'Text is processed by an AI service with Zero Data Retention \u2014 your data is not stored or used for training',
  'Reports are saved in your browser for up to 90 days, then automatically removed',
] as const;

const CONSENT_VERSION = '1.0';

function PrivacyConsentModal() {
  const privacyConsent = useAppStore((state) => state.privacyConsent);
  const setPrivacyConsent = useAppStore((state) => state.setPrivacyConsent);

  const isOpen = privacyConsent === null || privacyConsent === undefined;

  const handleAccept = useCallback(() => {
    const consent = {
      consentedAt: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    setPrivacyConsent(consent);
    logEvent('CONSENT_GIVEN');
  }, [setPrivacyConsent]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      closeOnOverlayClick={false}
      closeOnEsc={false}
      isCentered
      size="lg"
    >
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent mx={4} borderRadius="lg">
        <ModalHeader
          display="flex"
          alignItems="center"
          gap={2}
          color="gray.800"
          fontSize="lg"
          fontWeight={700}
          pb={2}
        >
          <FiShield color="var(--chakra-colors-blue-500)" />
          Privacy & Data Notice
        </ModalHeader>

        <ModalBody pt={0}>
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" color="gray.700" lineHeight={1.7}>
              This tool helps you create quarterly progress reports by analyzing
              photos of student work.
            </Text>

            <Text fontSize="sm" fontWeight={600} color="gray.700">
              Here&apos;s how your data is handled:
            </Text>

            <List spacing={3}>
              {PRIVACY_BULLETS.map((bullet) => (
                <ListItem
                  key={bullet}
                  fontSize="sm"
                  color="gray.600"
                  lineHeight={1.6}
                  display="flex"
                  alignItems="flex-start"
                >
                  <ListIcon
                    as={FiShield}
                    color="blue.400"
                    mt="3px"
                    flexShrink={0}
                  />
                  {bullet}
                </ListItem>
              ))}
            </List>

            <Text fontSize="sm" color="gray.600" lineHeight={1.7}>
              You can clear all stored data at any time using the &quot;Clear All
              My Data&quot; button.
            </Text>

            <Box
              bg="gray.50"
              p={3}
              borderRadius="md"
              border="1px solid"
              borderColor="gray.200"
            >
              <Text fontSize="xs" color="gray.500" lineHeight={1.6}>
                By continuing, you confirm you have the authority to process this
                student information as part of your professional duties.
              </Text>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter pt={2}>
          <Button
            bg="brand.700"
            color="white"
            _hover={{ bg: 'brand.800' }}
            _active={{ bg: 'brand.900' }}
            size="md"
            w="100%"
            fontWeight={600}
            onClick={handleAccept}
          >
            I Understand & Continue
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default PrivacyConsentModal;
