export const rtc: RTCConfiguration = {
    iceServers: [
        {
            urls: ['stun:stun.l.google.com:19302'],
        },
    ],
    iceTransportPolicy: "all",
    iceCandidatePoolSize: 10,
};

export const websocketURL = "wss://10.64.227.116:8000"