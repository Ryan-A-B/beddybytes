import React from 'react';
import * as AuthorizationServer from './AuthorizationServer';
import * as DeviceRegistrar from './DeviceRegistrar';
import Login from './Login';
import Registration from './Registration';
import Router from './Router';
import * as Config from './Config';
import './App.scss';

interface DeviceRegistrarProviderProps {
  config: Config.Config
  children: React.ReactNode
}

const DeviceRegistrarProvider: React.FunctionComponent<DeviceRegistrarProviderProps> = ({ config, children }) => {
  const authorization = AuthorizationServer.useAuthorization();
  const deviceRegistrar = React.useMemo(() => {
    return new DeviceRegistrar.DeviceRegistrarAPI(`https://${config.API.host}`, authorization);
  }, [config, authorization])
  return (
    <DeviceRegistrar.Context.Provider value={deviceRegistrar}>
      {children}
    </DeviceRegistrar.Context.Provider>
  );
}

const getConfig = async () => {
  const response = await fetch("/config.json")
  if (!response.ok) throw new Error("failed to fetch config")
  const config: Config.Config = await response.json()
  return config
}

const App: React.FunctionComponent = () => {
  const [config, setConfig] = React.useState<Config.Config | null>(null)
  React.useEffect(() => {
    getConfig()
      .then((config) => setConfig(config))
      .catch((error) => console.error(error))
  }, [])
  const authorizationServer = React.useMemo(() => {
    if (config === null) return null
    return new AuthorizationServer.AuthorizationServerAPI(`https://${config.API.host}`);
  }, [config])

  if (config === null) return null
  return (
    <div className="container">
      <Config.Context.Provider value={config}>
        <AuthorizationServer.Context.Provider value={authorizationServer}>
          <Login>
            <DeviceRegistrarProvider config={config}>
              <Registration>
                <Router />
              </Registration>
            </DeviceRegistrarProvider>
          </Login>
        </AuthorizationServer.Context.Provider>
      </Config.Context.Provider>
    </div>
  );
}

export default App;
