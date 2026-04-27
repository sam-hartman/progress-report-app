import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import App from './App';
import './index.css';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#f0f4f8',
      100: '#d9e2ec',
      200: '#bcccdc',
      300: '#9fb3c8',
      400: '#829ab1',
      500: '#627d98',
      600: '#486581',
      700: '#334e68',
      800: '#243b53',
      900: '#102a43',
    },
    maryland: {
      blue: '#003865',
      navy: '#002244',
      red: '#b31b1b',
      gold: '#c99700',
      white: '#ffffff',
    },
  },
  fonts: {
    body: '"Source Sans Pro", "Inter", system-ui, sans-serif',
    heading: '"Source Sans Pro", "Inter", system-ui, sans-serif',
  },
  components: {
    Card: {
      baseStyle: {
        container: {
          boxShadow: 'sm',
          borderRadius: 'md',
          border: '1px solid',
          borderColor: 'gray.200',
        },
      },
    },
    Button: {
      baseStyle: {
        fontWeight: 600,
        borderRadius: 'md',
      },
    },
    Heading: {
      baseStyle: {
        color: 'gray.800',
        letterSpacing: '-0.01em',
      },
    },
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
