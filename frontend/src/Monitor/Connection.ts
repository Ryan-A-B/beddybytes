import settings from "../settings"
import authorization from "../authorization";

type OnClose = () => void;

class Connection {
    private deviceID: string;
    private peerID: string;
    private websocket: WebSocket | null = null;
    private pc: RTCPeerConnection;
    onclose: OnClose | null = null;
    constructor(deviceID: string, peerID: string) {
        this.deviceID = deviceID;
        this.peerID = peerID;
        this.startWebSocket();
        this.pc = new RTCPeerConnection(settings.RTC);
        this.pc.onicecandidate = this.onICECandidate;
    }

    private startWebSocket = async () => {
        const accessToken = await authorization.getAccessToken();
        const query = new URLSearchParams({
            client_type: "monitor",
            client_alias: "monitor",
            access_token: accessToken,
        });
        const websocketURL = `wss://${settings.API.host}/clients/${this.deviceID}/websocket?${query.toString()}`;
        this.websocket = new WebSocket(websocketURL);
        this.websocket.onopen = this.onWebSocketOpen;
        this.websocket.onmessage = this.onWebSocketMessage;
        this.websocket.onerror = this.onWebSocketError;
    }

    private onWebSocketOpen = async () => {
        this.pc.addTransceiver('video', { direction: 'recvonly' })
        this.pc.addTransceiver('audio', { direction: 'recvonly' })
        await this.pc.setLocalDescription();
        if (this.websocket === null)
            throw new Error("this.websocket is null")
        this.websocket.send(JSON.stringify({
            to_peer_id: this.peerID,
            data: { description: this.pc.localDescription },
        }));
    }

    private onWebSocketMessage = async (event: MessageEvent) => {
        const frame = JSON.parse(event.data);
        if (frame.from_peer_id !== this.peerID) return;
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
        if (data.close !== undefined) {
            this.close();
            return
        }
    }

    private onWebSocketError = (event: Event) => {
        console.error(event);
    }

    private onICECandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null)
            return;
        if (this.websocket === null)
            throw new Error("this.websocket is null");
        this.websocket.send(JSON.stringify({
            to_peer_id: this.peerID,
            data: { candidate: event.candidate },
        }));
    }

    set onconnectionstatechange(connectionstatechange: (event: Event) => void) {
        this.pc.onconnectionstatechange = connectionstatechange;
    }

    set ontrack(ontrack: (event: RTCTrackEvent) => void) {
        this.pc.ontrack = ontrack;
    }

    close() {
        if (this.websocket !== null) {
            this.websocket.onopen = null;
            this.websocket.onmessage = null;
            this.websocket.onerror = null;
            this.websocket.close();
        }

        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.onconnectionstatechange = null;
        this.pc.close();

        if (this.onclose !== null) this.onclose();
    }
}

export default Connection;