export const rtc: RTCConfiguration = {
    iceServers: [
        {
            urls: ['stun:stun.l.google.com:19302'],
        },
    ],
    iceTransportPolicy: "all",
    iceCandidatePoolSize: 10,
};

export const serverHost = "10.64.227.116:8000"

export interface Client {
    id: string;
    type: string;
    alias: string;
}
