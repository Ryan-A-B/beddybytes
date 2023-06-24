import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import * as AuthorizationServer from './AuthorizationServer';
import * as DeviceRegistrar from './DeviceRegistrar';
import Login from './Login';
import Registration from './Registration';
import Navbar from './Navbar';
import * as Config from './Config';
import './App.scss';
import Instructions from './Instructions';
import Monitor from './Monitor';
import Camera from './Camera';

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
    <BrowserRouter>
      <Navbar />
      <Config.Context.Provider value={config}>
        <AuthorizationServer.Context.Provider value={authorizationServer}>
          <Login>
            <DeviceRegistrarProvider config={config}>
              <Registration>
                <div className="container">
                  <Routes>
                    <Route path="/" element={<Instructions />} />
                    <Route path="/camera" element={<Camera />} />
                    <Route path="/monitor" element={<Monitor />} />
                  </Routes>
                </div>
              </Registration>
            </DeviceRegistrarProvider>
          </Login>
        </AuthorizationServer.Context.Provider>
      </Config.Context.Provider>
    </BrowserRouter>
  );
}

export default App;
