import { v4 as uuid } from "uuid";

export interface Settings {
    RTC: RTCConfiguration
    API: {
        host: string
        clientID: string
    }
}

const getHost = () => {
    if (process.env.NODE_ENV === "development") {
        return "api.babymonitor.local:8443"
    }
    return "api.babymonitor.creativeilk.com"
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
