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

import './App.scss';

const App: React.FunctionComponent = () => {
  const connection_status = useConnectionStatus();
  const session_list = useSessionList();

  return (
    <React.Fragment>
      <Navbar />
      <div className="container">
        <Login>
          <Routes>
            <Route path="/" element={<Instructions />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/monitor" element={<Monitor session_list={session_list} />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </Login>
      </div>
    </React.Fragment>
  );
}

export default App;
