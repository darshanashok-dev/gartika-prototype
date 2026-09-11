/**
 * React Application Entrypoint for Gartika Urban Intelligence Dashboard.
 * 
 * Mounts the root App component to the DOM document root with React.StrictMode.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Mount the React Application to the DOM container
ReactDOM.createRoot(document.getElementById('root') || document.body).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
