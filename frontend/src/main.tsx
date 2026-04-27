import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import App from './App';
import './index.css';

// Extend Chakra theme for Maryland school colors
const theme = extendTheme({
  colors: {
    brand: {
      50: '#e6f4ff',
      100: '#cce7ff',
      200: '#99ceff',
      300: '#66b5ff',
      400: '#339cff',
      500: '#0084ff',
      600: '#006acc',
      700: '#005099',
      800: '#003566',
      900: '#001b33',
    },
    maryland: {
      blue: '#0066cc',
      red: '#cc0000',
      gold: '#ffcc00',
      white: '#ffffff',
    },
  },
  fonts: {
    body: 'Inter, system-ui, sans-serif',
    heading: 'Inter, system-ui, sans-serif',
  },
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
);
