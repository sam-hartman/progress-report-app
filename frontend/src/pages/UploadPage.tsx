// Upload page for images
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  VStack,
  useToast,
  Image,
  Icon,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
} from '@chakra-ui/react';
import { FiUpload, FiCamera, FiX, FiCheckCircle, FiImage } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { API } from '../utils/api';
import { useAppStore, useImages, useUpload, useSession } from '../stores/appStore';

function UploadPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const { images, addImage, removeImage } = useImages();
  const { upload, setUploadState, resetUpload } = useUpload();
  const { sessionId } = useSession();
  
  // Create session if doesn't exist
  useEffect(() => {
    if (!sessionId) {
      const createNewSession = async () => {
        try {
          const session = await API.session.create();
          useAppStore.getState().setSessionId(session.session_id);
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to create session',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      };
      createNewSession();
    }
  }, [sessionId, toast]);
  
  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file (JPEG, PNG, WebP)',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    // Set uploading state
    setUploadState({ is_uploading: true, upload_progress: 0, error: null });
    
    try {
      // Upload the file
      const image = await API.image.upload(file, sessionId || undefined);
      
      // Add to store
      addImage({
        ...image,
        preview_url: URL.createObjectURL(file),
        status: 'uploaded' as const,
      });
      
      // Create preview
      setPreviewUrl(URL.createObjectURL(file));
      
      toast({
        title: 'Image uploaded',
        description: 'Your image has been uploaded successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      setUploadState({ is_uploading: false, upload_progress: 100, error: null });
      
    } catch (error) {
      setUploadState({ 
        is_uploading: false, 
        upload_progress: 0, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      });
      
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload image',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [addImage, sessionId, setUploadState, toast]);
  
  // Dropzone configuration
  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    multiple: false,
    onDragEnter: () => {},
    onDragLeave: () => {},
  });
  
  // Capture image from camera
  const captureImage = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: 'Camera not available',
        description: 'Your device does not support camera access',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsCapturing(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
      });
      
      // Create video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });
      
      // Create canvas to capture image
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            
            // Upload the captured image
            const image = await API.image.upload(file, sessionId || undefined);
            addImage({
              ...image,
              preview_url: URL.createObjectURL(file),
              status: 'uploaded' as const,
            });
            
            setPreviewUrl(URL.createObjectURL(file));
            
            toast({
              title: 'Photo captured',
              description: 'Your photo has been captured and uploaded',
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
          }
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          setIsCapturing(false);
        }, 'image/jpeg', 0.9);
      }
      
    } catch (error) {
      setIsCapturing(false);
      toast({
        title: 'Camera error',
        description: 'Failed to access camera',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Remove image
  const handleRemoveImage = (imageId: string) => {
    removeImage(imageId);
    setPreviewUrl(null);
    resetUpload();
  };
  
  // Continue to OCR
  const handleContinue = () => {
    if (images.length === 0) {
      toast({
        title: 'No image',
        description: 'Please upload an image first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    navigate('/ocr');
  };
  
  // Clean up preview URLs
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);
  
  return (
    <VStack spacing={6} align="stretch">
      {/* Page Header */}
      <Box textAlign="center">
        <Heading as="h2" size="lg" mb={2}>
          Upload Student Work
        </Heading>
        <Text color="gray.600">
          Upload an image of student work to begin the progress report generation
        </Text>
      </Box>
      
      {/* Error Alert */}
      {upload.error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box flex="1">
            <AlertTitle>Upload Error</AlertTitle>
            <AlertDescription>{upload.error}</AlertDescription>
          </Box>
        </Alert>
      )}
      
      {/* Dropzone */}
      <Box 
        {...getRootProps()} 
        border="2px dashed" 
        borderColor={isDragActive ? 'blue.500' : 'gray.300'} 
        borderRadius="lg" 
        p={8} 
        textAlign="center" 
        cursor="pointer" 
        transition="all 0.2s" 
        bg={isDragActive ? 'blue.50' : 'gray.50'}
        _hover={{ bg: 'gray.100' }}
      >
        <input {...getInputProps()} />
        <Icon as={FiUpload} boxSize={12} color="gray.400" mb={4} />
        <Heading as="h3" size="md" mb={2}>
          {isDragActive ? 'Drop the image here' : 'Drag & Drop Image'}
        </Heading>
        <Text color="gray.500" mb={4}>
          or click to browse files
        </Text>
        <Text fontSize="sm" color="gray.400">
          Supports: JPEG, PNG, WebP (Max 10MB)
        </Text>
      </Box>
      
      {/* Camera Capture Button (Mobile) */}
      <Button 
        leftIcon={<FiCamera />} 
        colorScheme="blue" 
        onClick={captureImage} 
        isLoading={isCapturing}
        isDisabled={upload.is_uploading}
      >
        Take Photo with Camera
      </Button>
      
      {/* Image Preview */}
      {previewUrl && (
        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Text fontWeight="bold">Image Preview</Text>
              <Button 
                leftIcon={<FiX />} 
                size="sm" 
                colorScheme="red" 
                variant="ghost" 
                onClick={() => handleRemoveImage(images[0]?.image_id || '')}
              >
                Remove
              </Button>
            </Flex>
          </CardHeader>
          <CardBody>
            <Image 
              src={previewUrl} 
              alt="Preview" 
              maxH="400px" 
              objectFit="contain" 
              borderRadius="md"
            />
          </CardBody>
        </Card>
      )}
      
      {/* Uploaded Images List */}
      {images.length > 0 && (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
          {images.map((image) => (
            <Card key={image.image_id}>
              <CardBody>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontSize="sm" color="gray.500">
                    {image.filename}
                  </Text>
                  <Icon 
                    as={FiCheckCircle} 
                    color="green.500" 
                    boxSize={5}
                  />
                </Flex>
                {image.preview_url && (
                  <Image 
                    src={image.preview_url} 
                    alt={image.filename} 
                    maxH="200px" 
                    objectFit="contain" 
                    borderRadius="md"
                  />
                )}
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
      
      {/* Continue Button */}
      <Button 
        colorScheme="blue" 
        size="lg" 
        onClick={handleContinue}
        isDisabled={images.length === 0 || upload.is_uploading}
        rightIcon={<FiImage />}
      >
        Continue to OCR
      </Button>
    </VStack>
  );
}

export default UploadPage;
