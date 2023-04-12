export const rtc: RTCConfiguration = {
    iceServers: [
        {
            urls: ['stun:10.64.227.116:3478'],
            username: '',
            credential: '',
        },
        {
            urls: ['turn:10.64.227.116:3478'],
            username: '1681364435',
            credential: 'XMgsWVLt1h3DJDvUZCKLjGrUJv8=',
        },
    ],
    iceTransportPolicy: "all",
    iceCandidatePoolSize: 10,
};