import React from 'react';

export interface Device {
    id: string
    type: string
}

export interface DeviceRegistrar {
    register: (device: Device) => Promise<Device>
    list: () => Promise<Device[]>
}

export class MockDeviceRegistrar implements DeviceRegistrar {
    private devices: Device[] = [
        { id: 'camera', type: 'camera' }
    ]

    register(device: Device): Promise<Device> {
        this.devices.push(device)
        return Promise.resolve(device)
    }

    list(): Promise<Device[]> {
        return Promise.resolve([])
    }
}

export const Context = React.createContext<DeviceRegistrar | null>(null);

export const useDeviceRegistrar = () => {
    const deviceRegistrar = React.useContext(Context)
    if (!deviceRegistrar) throw new Error('No device registrar provided')
    return deviceRegistrar
}

export const DeviceContext = React.createContext<Device | null>(null)

export const useDevice = () => {
    const device = React.useContext(DeviceContext)
    if (!device) throw new Error('No device provided')
    return device
}
