import React from 'react';
import { v4 as uuid } from 'uuid';
import * as DeviceRegistrar from '../DeviceRegistrar';

const LocalStorageKey = "device_id"

const useDeviceID = (): string => {
    return React.useMemo(() => {
        const deviceID = localStorage.getItem(LocalStorageKey);
        if (deviceID !== null) return deviceID;
        const newDeviceID = uuid();
        localStorage.setItem(LocalStorageKey, newDeviceID);
        return newDeviceID;
    }, []);
}

interface Props {
    children: React.ReactNode

}

const Registration: React.FunctionComponent<Props> = ({ children }) => {
    const deviceID = useDeviceID();
    const device = React.useMemo(() => {
        return {
            id: deviceID,
        }
    }, [deviceID]);
    return (
        <DeviceRegistrar.DeviceContext.Provider value={device}>
            {children}
        </DeviceRegistrar.DeviceContext.Provider>
    )
}

export default Registration
