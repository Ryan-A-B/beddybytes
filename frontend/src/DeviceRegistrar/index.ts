import React from 'react';

type DeviceTypeMonitor = 'monitor';
type DeviceTypeCamera = 'camera';
type DeviceType = DeviceTypeMonitor | DeviceTypeCamera;

export interface Device {
    id: string
    type?: DeviceType
    alias?: string
}

export interface DeviceRegistrar {
    list: () => Promise<Device[]>
}

export class MockDeviceRegistrar implements DeviceRegistrar {
    private devices: Device[] = [
        { id: 'camera' },
    ]

    list = async () => {
        return Promise.resolve(this.devices)
    }
}

export class DeviceRegistrarAPI implements DeviceRegistrar {
    private baseURL: string
    private authorization: string

    constructor(baseUrl: string, authorization: string) {
        this.baseURL = baseUrl
        this.authorization = authorization
    }

    list = async () => {
        const response = await fetch(`${this.baseURL}/clients`, {
            method: 'GET',
            headers: {
                "Authorization": this.authorization,
            }
        })
        if (!response.ok) {
            const payload = await response.text()
            throw new Error(`Failed to list devices: ${payload}`)
        }
        const payload = await response.json()
        return payload as Device[]
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
