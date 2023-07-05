export interface Settings {
    RTC: RTCConfiguration
    API: {
        host: string
    }
}

const getHost = () => {
    if (process.env.NODE_ENV === "development") {
        return "api.babymonitor.local:8443"
    }
    return "api.babymonitor.creativeilk.com"
}

const settings: Settings = {
    RTC: {
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302"
                ]
            }
        ],
        iceTransportPolicy: "all",
        iceCandidatePoolSize: 10
    },
    API: {
        host: getHost()
    }
}

export default settings
