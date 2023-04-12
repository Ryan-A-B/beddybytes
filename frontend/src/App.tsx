import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import Index from './Home';
import Camera from './Camera';
import Monitor from './Monitor';

function App() {
  return (
    <div className="container">
      <BrowserRouter>
      <Routes>
        <Route index element={<Index />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/monitor" element={<Monitor />} />
      </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
