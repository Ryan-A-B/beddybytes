import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { Services, context as ServicesContext } from './services';
import { Severity } from './services/LoggingService';
import logging_service from "./services/instances/logging_service"
import authorization_service from "./services/instances/authorization_service"
import signal_service from "./services/instances/signal_service"
import error_service from "./services/instances/error_service"

import Login from './pages/Login';
import Instructions from './pages/Instructions';
import BabyStation from './pages/BabyStation';
import ParentStation from './pages/ParentStation';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Errors from './components/Errors';

import './App.scss';
import RequestPasswordReset from './pages/Login/RequestPasswordReset';
import ResetPassword from './pages/Login/ResetPassword';

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
        <div className="position-relative">
          <Routes>
            <Route path="/request-password-reset" element={<RequestPasswordReset />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={
              <Login>
                <Errors error_service={error_service} />
                <div className="pt-3">
                  <Routes>
                    <Route path="/" element={<Instructions />} />
                    <Route path="/baby" element={<BabyStation />} />
                    <Route path="/parent" element={<ParentStation />} />
                  </Routes>
                </div>
              </Login>
            }>
            </Route>
          </Routes>
        </div>
      </div>
      <Footer />
    </ServicesContext.Provider >
  );
}

export default App;

window.addEventListener('error', function (event: ErrorEvent) {
  logging_service.log({
    severity: Severity.Critical,
    message: `Uncaught error: ${event.message} ${event.filename}:${event.lineno}`,
  });
  error_service.add_error(event.error);
})

window.addEventListener('unhandledrejection', function (event: PromiseRejectionEvent) {
  const reason_is_error = event.reason instanceof Error
  if (!reason_is_error) {
    logging_service.log({
      severity: Severity.Critical,
      message: `Unhandled rejection: ${event.reason}`,
    });
    return;
  }
  logging_service.log({
    severity: Severity.Critical,
    message: `Unhandled rejection: ${event.reason} ${event.reason.stack}`,
  });
  error_service.add_error(event.reason);
})
