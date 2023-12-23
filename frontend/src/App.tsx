import React from 'react';
import { Route, Routes } from 'react-router-dom';

import logging_service from "./services/instances/logging_service"
import account_service from "./services/instances/account_service"
import authorization_service from "./services/instances/authorization_service"
import client_session_service from "./services/instances/client_session_service"
import event_service from "./services/instances/event_service"
import signal_service from "./services/instances/signal_service"
import media_stream_service from "./services/instances/media_stream_service"
import host_session_service from "./services/instances/host_session_service"
import media_device_permission_service from "./services/instances/media_device_permission_service"
import session_list_service from "./services/instances/session_list_service"
import service_worker_service from "./services/instances/service_worker_service"

import Navbar from './components/Navbar';
import UpdateAvailableAlert from './components/UpdateAvailableAlert';
import Login from './pages/Login';
import Instructions from './pages/Instructions';
import Camera from './pages/Camera';
import Monitor from './pages/Monitor';
import Account from './pages/Account';
import { Services, context as ServicesContext } from './services';

import './App.scss';

export const services: Services = {
  logging_service,
  account_service,
  authorization_service,
  client_session_service,
  event_service,
  signal_service,
  media_device_permission_service,
  media_stream_service,
  host_session_service,
  session_list_service,
  service_worker_service,
};

const App: React.FunctionComponent = () => {
  return (
    <ServicesContext.Provider value={services}>
      <Navbar />
      <div className="container">
        <UpdateAvailableAlert />
        <Login>
          <Routes>
            <Route path="/" element={<Instructions />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </Login>
      </div>
    </ServicesContext.Provider>
  );
}

export default App;
