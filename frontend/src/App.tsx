import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';
import Registration from './Registration';
import Navbar from './Navbar';
import Payments from './Payments';
import Instructions from './Instructions';
import Monitor from './Monitor';
import Camera from './Camera';
import './App.scss';

const App: React.FunctionComponent = () => {
  return (
      <BrowserRouter>
        <Navbar />
          <Login>
            <Registration>
              <div className="container">
                <Payments />
                <Routes>
                  <Route path="/" element={<Instructions />} />
                  <Route path="/camera" element={<Camera />} />
                  <Route path="/monitor" element={<Monitor />} />
                </Routes>
              </div>
            </Registration>
          </Login>
      </BrowserRouter>
  );
}

export default App;
