import React from 'react';
import * as AuthorizationServer from './AuthorizationServer';
import * as DeviceRegistrar from './DeviceRegistrar';
import Login from './Login';
import Registration from './Registration';
import Router from './Router';
import * as config from './config';
import './App.scss';

const authorizationServer = new AuthorizationServer.AuthorizationServerAPI(`https://${config.serverHost}`);

interface DeviceRegistrarProviderProps {
  children: React.ReactNode
}

const DeviceRegistrarProvider: React.FunctionComponent<DeviceRegistrarProviderProps> = ({ children }) => {
  const authorization = AuthorizationServer.useAuthorization();
  const deviceRegistrar = React.useMemo(() => {
    return new DeviceRegistrar.DeviceRegistrarAPI(`https://${config.serverHost}`, authorization);
  }, [authorization])
  return (
    <DeviceRegistrar.Context.Provider value={deviceRegistrar}>
      {children}
    </DeviceRegistrar.Context.Provider>
  );
}

const App: React.FunctionComponent = () => {
  return (
    <div className="container">
      <AuthorizationServer.Context.Provider value={authorizationServer}>
        <Login>
          <DeviceRegistrarProvider>
            <Registration>
              <Router />
            </Registration>
          </DeviceRegistrarProvider>
        </Login>
      </AuthorizationServer.Context.Provider>
    </div>
  );
}

export default App;
