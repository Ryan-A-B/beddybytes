import { Map } from "immutable";
import settings from "../settings";
import authorization from "../authorization";

class Connections {
    private deviceID: string;
    private sessionName: string;
    private stream: MediaStream;
    private websocket: WebSocket | null = null;
    private pcs: Map<string, RTCPeerConnection> = Map();
    constructor(deviceID: string, sessionName: string, stream: MediaStream) {
        this.deviceID = deviceID;
        this.sessionName = sessionName;
        this.stream = stream;
        this.startWebSocket();
    }

    private startWebSocket = async () => {
        const accessToken = await authorization.getAccessToken();
        const query = new URLSearchParams({
            client_type: "camera",
            client_alias: this.sessionName,
            access_token: accessToken,
        });
        const websocketURL = `wss://${settings.API.host}/clients/${this.deviceID}/websocket?${query.toString()}`;
        this.websocket = new WebSocket(websocketURL);
        this.websocket.onmessage = this.onMessage;
    }

    private onMessage = async (event: MessageEvent) => {
        const frame = JSON.parse(event.data);
        const data = frame.data;
        if (data.description !== undefined) {
            if (data.description.type !== "offer")
                throw new Error("data.description.type is not answer");
            this.closeExistingPeerConnectionIfAny(frame.from_peer_id);
            const pc = new RTCPeerConnection(settings.RTC);
            pc.onicecandidate = this.onICECandidate(frame.from_peer_id);
            this.pcs = this.pcs.set(frame.from_peer_id, pc);
            await pc.setRemoteDescription(data.description);
            this.stream.getTracks().forEach((track) => pc.addTrack(track, this.stream));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (this.websocket === null)
                throw new Error("this.websocket is null");
            this.websocket.send(JSON.stringify({
                to_peer_id: frame.from_peer_id,
                data: { description: answer },
            }));
            return
        }
        if (data.candidate !== undefined) {
            const pc = this.pcs.get(frame.from_peer_id);
            if (pc === undefined) throw new Error(`PeerConnection is not found: ${frame.from_peer_id}`);
            const candidate = new RTCIceCandidate(data.candidate);
            await pc.addIceCandidate(candidate);
            return
        }
    }

    private closeExistingPeerConnectionIfAny(peerID: string) {
        const existing = this.pcs.get(peerID);
        if (existing !== undefined) {
            existing.close();
        }
    }

    private onICECandidate = (peerID: string) => (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null) return;
        if (this.websocket === null)
            throw new Error("this.websocket is null");
        this.websocket.send(JSON.stringify({
            to_peer_id: peerID,
            data: { candidate: event.candidate },
        }));
    }

    close = () => {
        this.pcs.forEach((pc, deviceID) => {
            // TODO send this via RTCDataChannel
            if (this.websocket === null)
                throw new Error("this.websocket is null");
            this.websocket.send(JSON.stringify({
                to_peer_id: deviceID,
                data: { close: null },
            }));
            pc.close()
        });
        if (this.websocket === null)
            throw new Error("this.websocket is null");
        this.websocket.onmessage = null;
        this.websocket.close();
    }
}

export default Connections;
