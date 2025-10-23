import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';

console.log('=== UI index.tsx loading ===');
console.log('React version:', React.version);

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (!rootElement) {
  console.error('Root element not found!');
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
console.log('ReactDOM root created');

root.render(<App />);
console.log('App rendered');
