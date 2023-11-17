import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Instructions from './pages/Instructions';
import Camera from './pages/Camera';
import Monitor from './pages/Monitor';
import Account from './pages/Account';

import useConnectionStatus from './hooks/useConnectionStatus';
import useSessionList from './hooks/useSessionList';

import { ConnectionFactory } from './pages/Monitor/Connection';
import MockConnectionFactory from './pages/Monitor/Connection/MockConnectionFactory';
import RTCConnectionFactory from './pages/Monitor/Connection/RTCConnectionFactory';

import './App.scss';

const App: React.FunctionComponent = () => {
  const connection_status = useConnectionStatus();
  const session_list = useSessionList();

  const connectionFactory = React.useMemo<ConnectionFactory>(() => {
    if (connection_status.status === "not_connected") return new MockConnectionFactory();
    const signaler = connection_status.connection;
    return new RTCConnectionFactory(signaler);
  }, [connection_status]);

  return (
    <React.Fragment>
      <Navbar />
      <div className="container">
        <Login>
          <Routes>
            <Route path="/" element={<Instructions />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/monitor" element={<Monitor factory={connectionFactory} session_list={session_list} />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </Login>
      </div>
    </React.Fragment>
  );
}

export default App;
