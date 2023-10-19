import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';
import Navbar from './Navbar';
import Payments from './Payments';
import Instructions from './Instructions';
import Camera from './Camera';
import Monitor from './Monitor';
import Account from './Account';

import useConnection from "./Connection/useConnection";
import RTCConnectionFactory from './Monitor/Connection/RTCConnectionFactory';
import SessionsReaderAPI from './Sessions/SessionsReaderAPI';

import './App.scss';

const App: React.FunctionComponent = () => {
  const signaler = useConnection();
  const [connectionFactory, sessions] = React.useMemo(() => {
    return [
      new RTCConnectionFactory(signaler),
      new SessionsReaderAPI(signaler),
    ];
  }, [signaler]);

  return (
    <BrowserRouter>
      <Navbar />
      <Login>
        <div className="container">
          <Payments />
          <Routes>
            <Route path="/" element={<Instructions />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/monitor" element={<Monitor factory={connectionFactory} sessions={sessions} />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </div>
      </Login>
    </BrowserRouter>
  );
}

export default App;
