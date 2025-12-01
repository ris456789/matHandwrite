import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';

const clerkPubKey = 'pk_test_dXB3YXJkLWhhZGRvY2stNDguY2xlcmsuYWNjb3VudHMuZGV2JA';

console.log('Clerk Key:', clerkPubKey);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);