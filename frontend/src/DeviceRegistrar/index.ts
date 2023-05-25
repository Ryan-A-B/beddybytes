import React from 'react';

export interface Device {
    id: string
    type: string
    alias: string
}

export interface DeviceRegistrar {
    list: () => Promise<Device[]>
}

export class MockDeviceRegistrar implements DeviceRegistrar {
    private devices: Device[] = [
        { id: 'camera', type: 'camera', alias: 'Camera' },
    ]

    list(): Promise<Device[]> {
        return Promise.resolve(this.devices)
    }
}

export class DeviceRegistrarAPI implements DeviceRegistrar {
    private baseUrl: string

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl
    }

    list(): Promise<Device[]> {
        return fetch(`${this.baseUrl}/clients`)
            .then((response) => response.json())
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
