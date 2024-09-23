import { v4 as uuid } from "uuid";

export interface Settings {
    RTC: RTCConfiguration
    API: {
        host: string
        clientID: string
    }
}

const tryGetItemFromLocalStorage = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.error(e)
        return null
    }
}

const getHost = (): string => {
    const host = tryGetItemFromLocalStorage("API_HOST")
    if (host !== null)
        return host
    if (process.env.NODE_ENV === "development") {
        return "api.beddybytes.local"
    }
    return "api.beddybytes.com"
}

const getClientID = (): string => {
    const key = "clientID";
    const clientID = localStorage.getItem(key);
    if (clientID !== null) return clientID;
    const newClientID = uuid();
    localStorage.setItem(key, newClientID);
    return newClientID;
}

const settings: Settings = {
    RTC: {
        iceServers: [],
        iceCandidatePoolSize: 4,
    },
    API: {
        host: getHost(),
        clientID: getClientID(),
    },
}

export default settings

declare global {
    interface Window {
        set_host: (host: string) => void
    }
}

window.set_host = (host: string) => {
    localStorage.setItem("API_HOST", host)
    window.location.reload()
}
