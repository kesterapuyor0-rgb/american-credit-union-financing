import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
