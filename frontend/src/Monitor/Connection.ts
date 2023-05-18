import * as config from '../config';

class Connection {
    private peerID: string;
    private websocket: WebSocket;
    private pc: RTCPeerConnection;
    constructor(clientID: string, peerID: string) {
        this.peerID = peerID;
        this.websocket = new WebSocket(`wss://${config.serverHost}/clients/${clientID}/websocket`);
        this.websocket.onopen = this.onOpen;
        this.websocket.onmessage = this.onMessage;
        this.pc = new RTCPeerConnection(config.rtc);
        this.pc.onicecandidate = this.onICECandidate;
    }

    private onOpen = async () => {
        this.pc.addTransceiver('video', { direction: 'recvonly' })
        this.pc.addTransceiver('audio', { direction: 'recvonly' })
        await this.pc.setLocalDescription();
        this.websocket.send(JSON.stringify({
            to_peer_id: this.peerID,
            data: { description: this.pc.localDescription },
        }));
    }

    private onMessage = async (event: MessageEvent) => {
        const frame = JSON.parse(event.data);
        const data = frame.data;
        if (data.description !== undefined) {
            if (data.description.type !== "answer")
                throw new Error("data.description.type is not answer");
            await this.pc.setRemoteDescription(data.description);
        }
        if (data.candidate !== undefined) {
            const candidate = new RTCIceCandidate(data.candidate);
            await this.pc.addIceCandidate(candidate);
            return
        }
    }

    private onICECandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null) return;
        this.websocket.send(JSON.stringify({
            to_peer_id: this.peerID,
            data: { candidate: event.candidate },
        }));
    }

    set ontrack(ontrack: (event: RTCTrackEvent) => void) {
        this.pc.ontrack = ontrack;
    }

    close() {
        this.websocket.onopen = null;
        this.websocket.onmessage = null;
        this.websocket.close();

        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.close();
    }
}

export default Connection;