import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle and suppress third-party extension error noise (e.g. MetaMask / wallet extension rejections in preview sandbox)
window.addEventListener('error', (event) => {
  const msg = event.message || event.error?.message || '';
  if (msg.includes('MetaMask') || msg.includes('ethereum') || msg.includes('web3')) {
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || (typeof reason === 'string' ? reason : '');
  if (msg.includes('MetaMask') || msg.includes('ethereum') || msg.includes('web3')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

