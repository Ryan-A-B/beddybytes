import React from 'react';

type DeviceTypeMonitor = 'monitor';
type DeviceTypeCamera = 'camera';
type DeviceType = DeviceTypeMonitor | DeviceTypeCamera;

export interface Device {
    id: string
    type?: DeviceType
    alias?: string
}

export const DeviceContext = React.createContext<Device | null>(null)

export const useDevice = () => {
    const device = React.useContext(DeviceContext)
    if (!device) throw new Error('No device provided')
    return device
}
