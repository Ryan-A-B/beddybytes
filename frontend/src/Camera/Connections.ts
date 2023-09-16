import { Map } from "immutable";
import settings from "../settings";
import { Signaler } from "../Connection/Connection";

class Connections {
    private signaler: Signaler;
    private stream: MediaStream;
    private pcs: Map<string, RTCPeerConnection> = Map();
    constructor(signaler: Signaler, stream: MediaStream) {
        this.signaler = signaler;
        this.stream = stream;
        this.signaler.addEventListener("signal", this.onSignal);
    }

    private onSignal = async (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const frame = event.detail;
        const data = frame.data;
        if (data.description !== undefined) {
            if (data.description.type !== "offer")
                throw new Error("data.description.type is not offer");
            this.closeExistingPeerConnectionIfAny(frame.from_connection_id);
            const pc = new RTCPeerConnection(settings.RTC);
            pc.onicecandidate = this.onICECandidate(frame.from_connection_id);
            this.pcs = this.pcs.set(frame.from_connection_id, pc);
            await pc.setRemoteDescription(data.description);
            this.stream.getTracks().forEach((track) => pc.addTrack(track, this.stream));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.signaler.sendSignal({
                to_connection_id: frame.from_connection_id,
                data: { description: answer },
            });
            return
        }
        if (data.candidate !== undefined) {
            const pc = this.pcs.get(frame.from_connection_id);
            if (pc === undefined) throw new Error(`PeerConnection is not found: ${frame.from_connection_id}`);
            const candidate = new RTCIceCandidate(data.candidate);
            await pc.addIceCandidate(candidate);
            return
        }
        if (data.close !== undefined) {
            this.closeExistingPeerConnectionIfAny(frame.from_connection_id);
            return
        }
    }

    private closeExistingPeerConnectionIfAny(peerConnectionID: string) {
        const existing = this.pcs.get(peerConnectionID);
        if (existing !== undefined) {
            existing.onicecandidate = null;
            existing.close();
        }
    }

    private onICECandidate = (peerConnectionID: string) => (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null) return;
        this.signaler.sendSignal({
            to_connection_id: peerConnectionID,
            data: { candidate: event.candidate },
        });
    }

    close = () => {
        this.pcs.forEach((pc, peerConnectionID) => {
            // TODO send this via RTCDataChannel
            // a session ended event gets sent so this is not necessary
            this.signaler.sendSignal({
                to_connection_id: peerConnectionID,
                data: { close: null },
            });
            pc.close()
        });
        this.signaler.removeEventListener("signal", this.onSignal);
    }
}

export default Connections;
