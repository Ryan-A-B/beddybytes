import React from "react";
import config from "../RTCConfig";

const websocketURL = "wss://10.64.227.111:8000/ws";

const Monitor: React.FunctionComponent = () => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    React.useEffect(() => {
        const ws = new WebSocket(websocketURL);
        const pc = new RTCPeerConnection(config)
        const candidates: RTCIceCandidate[] = [];
        pc.ontrack = (event) => {
            console.log(event)
            if (videoRef.current === null) return;
            videoRef.current.srcObject = event.streams[0];
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
            console.log(pc.iceGatheringState)
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
    }, [])
    return (
        <div>
            <video ref={videoRef} autoPlay playsInline />
        </div>
    );
};

export default Monitor;