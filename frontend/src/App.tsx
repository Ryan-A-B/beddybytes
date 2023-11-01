import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
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
import PageViewTracker from './Analytics/PageViewTracker';
import analytics from './Analytics';

import './App.scss';

const App: React.FunctionComponent = () => {
  const location = useLocation();
  const signaler = useConnection();
  const [connectionFactory, sessions] = React.useMemo(() => {
    return [
      new RTCConnectionFactory(signaler),
      new SessionsReaderAPI(signaler),
    ];
  }, [signaler]);

  return (
    <React.Fragment>
      <Navbar />
      <Login>
        <div className="container">
          <Payments />
          <PageViewTracker analytics={analytics} page={location.pathname} />
          <Routes>
            <Route path="/" element={<Instructions />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/monitor" element={<Monitor factory={connectionFactory} sessions={sessions} />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </div>
      </Login>
    </React.Fragment>
  );
}

export default App;
