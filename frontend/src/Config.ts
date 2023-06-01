import React from 'react';

export interface Config {
    RTC: RTCConfiguration
    API: {
        host: string
    }
}

export const Context = React.createContext<Config | null>(null)

export const useConfig = () => {
    const config = React.useContext(Context)
    if (config === null) throw new Error("Config is null")
    return config
}