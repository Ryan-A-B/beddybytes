import React from 'react';
import { Route, Routes } from 'react-router-dom';

import logging_service from "./services/instances/logging_service"
import authorization_service from "./services/instances/authorization_service"
import signal_service from "./services/instances/signal_service"

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './pages/Login';
import Instructions from './pages/Instructions';
import BabyStation from './pages/BabyStation';
import ParentStation from './pages/ParentStation';
import { Services, context as ServicesContext } from './services';

import './App.scss';

export const services: Services = {
  logging_service,
  authorization_service,
  signal_service,
};

const App: React.FunctionComponent = () => {
  return (
    <ServicesContext.Provider value={services}>
      <div className="wrapper">
        <Navbar />
        <Login>
          <Routes>
            <Route path="/" element={<Instructions />} />
            <Route path="/baby" element={<BabyStation />} />
            <Route path="/parent" element={<ParentStation />} />
          </Routes>
        </Login>
      </div>
      <Footer />
    </ServicesContext.Provider>
  );
}

export default App;
