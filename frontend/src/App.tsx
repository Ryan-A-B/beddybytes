import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { Severity } from './services/LoggingService';
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

window.addEventListener('error', function (event: ErrorEvent) {
  logging_service.log({
    severity: Severity.Critical,
    message: `Uncaught error: ${event.message} ${event.filename}:${event.lineno}`,
  })
})

window.addEventListener('unhandledrejection', function (event: PromiseRejectionEvent) {
  const reason_is_error = event.reason instanceof Error
  if (!reason_is_error) {
    logging_service.log({
      severity: Severity.Critical,
      message: `Unhandled rejection: ${event.reason}`,
    })
    return
  }
  logging_service.log({
    severity: Severity.Critical,
    message: `Unhandled rejection: ${event.reason} ${event.reason.stack}`,
  })
})
