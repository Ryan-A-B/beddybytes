const config: RTCConfiguration = {
    iceServers: [
        {
            urls: ['stun:10.64.227.111:3478'],
            username: '',
            credential: '',
        },
        {
            urls: ['turn:10.64.227.111:3478'],
            username: '1680419904',
            credential: 'CgVFl+tbrWK960pA8sghwsG7UgU=',
        },
    ],
    iceTransportPolicy: "all",
    iceCandidatePoolSize: 10,
};

export default config;