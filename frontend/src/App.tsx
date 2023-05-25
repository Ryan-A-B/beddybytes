import React from 'react';
import * as AuthorizationServer from './AuthorizationServer';
import * as DeviceRegistrar from './DeviceRegistrar';
import Login from './Login';
import Registration from './Registration';
import Router from './Router';
import * as config from './config';
import './App.scss';

const authenticator = new AuthorizationServer.MockAuthorizationServer();
const deviceRegistrar = new DeviceRegistrar.DeviceRegistrarAPI(`https://${config.serverHost}`);

function App() {
  return (
    <div className="container">
      <AuthorizationServer.Context.Provider value={authenticator}>
        <DeviceRegistrar.Context.Provider value={deviceRegistrar}>
          {/* <Login> */}
            <Registration>
              <Router />
            </Registration>
          {/* </Login> */}
        </DeviceRegistrar.Context.Provider>
      </AuthorizationServer.Context.Provider>
    </div>
  );
}

export default App;
