import React from "react";
import * as config from "../config";
import "./Monitor.scss";

const websocketURL = "wss://10.64.227.116:8000/ws";

const MonitorComponent: React.FunctionComponent = () => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const websocketRef = React.useRef<WebSocket | null>(null);
    const peerConnectionRef = React.useRef<RTCPeerConnection | null>(null);
    React.useEffect(() => {
        if (websocketRef.current !== null) return;
        if (peerConnectionRef.current !== null) return;
        const video = videoRef.current;
        if (video === null) return;
        const ws = new WebSocket(websocketURL);
        const pc = new RTCPeerConnection(config.rtc)
        const candidates: RTCIceCandidate[] = [];
        pc.ontrack = (event) => {
            console.log(event)
            video.srcObject = event.streams[0];
        }
        pc.onconnectionstatechange = (event) => {
            console.log(pc.connectionState, event)
        }
        pc.oniceconnectionstatechange = (event) => {
            console.log(pc.iceConnectionState, event)
        }
        pc.onicecandidate = (event) => {
            console.log(event)
            if (!event.candidate) return;
            candidates.push(event.candidate);
        }
        pc.onicegatheringstatechange = async () => {
            if (pc.iceGatheringState !== 'complete') return;
            ws.send(JSON.stringify({
                type: "data",
                to_peer_id: "camera",
                data: {
                    type: "offer_and_candidates",
                    offer: pc.localDescription,
                    candidates,
                },
            }));
        }
        ws.onopen = async () => {
            ws.send(JSON.stringify({
                type: "register",
                register: {
                    id: "monitor",
                    peer_ids: ["camera"],
                },
            }));
            pc.addTransceiver('video', { direction: 'recvonly' })
            pc.addTransceiver('audio', { direction: 'recvonly' })
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
        }
        ws.onmessage = async (event) => {
            console.log(event)
            const frame = JSON.parse(event.data)
            const data = frame.data
            if (data.type !== 'answer') return
            await pc.setRemoteDescription(data)
            ws.close()
        }
        websocketRef.current = ws;
        peerConnectionRef.current = pc;
        return () => {
            ws.close();
            pc.close();
            websocketRef.current = null;
            peerConnectionRef.current = null;
        }
    }, [])
    return (
        <div className="monitor">
            <video ref={videoRef} autoPlay playsInline className="video" />
        </div>
    );
};

export default MonitorComponent;