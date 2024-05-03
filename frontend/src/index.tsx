import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

const register_service_worker = () => {
  if (process.env.NODE_ENV !== 'production') return;
  const service_worker_available = 'serviceWorker' in navigator;
  if (!service_worker_available) return;
  navigator.serviceWorker.register(`/service-worker.js`, { scope: '/' })
}

register_service_worker();
