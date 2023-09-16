import { Signaler } from "../Connection/Connection";
import { Session } from "../Sessions/Sessions";
import settings from "../settings"

type OnClose = () => void;

class Connection {
    private signaler: Signaler;
    private session: Session;
    private pc: RTCPeerConnection;
    onclose: OnClose | null = null;
    constructor(signaler: Signaler, session: Session) {
        this.signaler = signaler;
        this.session = session;
        this.pc = new RTCPeerConnection(settings.RTC);
        this.pc.onicecandidate = this.onICECandidate;
        this.sendDescription()
        this.signaler.addEventListener("signal", this.onSignal);
    }

    private sendDescription = async () => {
        this.pc.addTransceiver('video', { direction: 'recvonly' })
        this.pc.addTransceiver('audio', { direction: 'recvonly' })
        await this.pc.setLocalDescription();
        this.signaler.sendSignal({
            to_connection_id: this.session.host_connection_id,
            data: { description: this.pc.localDescription },
        });
    }

    private onSignal = async (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const frame = event.detail;
        if (frame.from_connection_id !== this.session.host_connection_id) return;
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
            // The host doesn't need to send this anymore, a session ended event is sent instead
            this.close(true);
            return
        }
    }

    private onICECandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null)
            return;
        this.signaler.sendSignal({
            to_connection_id: this.session.host_connection_id,
            data: { candidate: event.candidate },
        });
    }

    set onconnectionstatechange(connectionstatechange: (event: Event) => void) {
        this.pc.onconnectionstatechange = connectionstatechange;
    }

    set ontrack(ontrack: (event: RTCTrackEvent) => void) {
        this.pc.ontrack = ontrack;
    }

    close(initiatedByHost: boolean) {
        if (!initiatedByHost) return;
        this.signaler.sendSignal({
            to_connection_id: this.session.host_connection_id,
            data: { close: null },
        });
        this.signaler.removeEventListener("signal", this.onSignal);

        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.onconnectionstatechange = null;
        this.pc.close();

        if (this.onclose !== null) this.onclose();
    }
}

export default Connection;