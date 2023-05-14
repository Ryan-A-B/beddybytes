import React from "react";
// import * as config from "../config";
import "./Monitor.scss";
import Video from "./Video";

const Monitor: React.FunctionComponent = () => {
    const [peerID, setPeerID] = React.useState<string>("");
    const connect = React.useCallback(() => {
        setPeerID("camera");
    }, [setPeerID]);
    // const [stream, setStream] = React.useState<MediaStream | null>(null);
    // const videoRef = React.useRef<HTMLVideoElement>(null);
    // React.useEffect(() => {
    //     if (videoRef.current === null) return;
    //     if (stream === null) return;
    //     const video = videoRef.current;
    //     video.srcObject = stream;
    //     video.play();
    // }, [stream])
    // const [peerConnection, setPeerConnection] = React.useState<RTCPeerConnection | null>(null);
    // React.useEffect(() => {
    //     if (peerConnection === null) return;
    //     return () => {
    //         peerConnection.ontrack = null;
    //         peerConnection.onicecandidate = null;
    //         peerConnection.onicegatheringstatechange = null;
    //         peerConnection.close()
    //     }
    // }, [peerConnection])
    // const connect = React.useCallback(() => {
    //     const ws = new WebSocket(config.websocketURL);
    //     const peerConnection = new RTCPeerConnection(config.rtc);
    //     const candidates: RTCIceCandidate[] = [];
    //     peerConnection.ontrack = (event) => {
    //         setStream(event.streams[0])
    //     }
    //     peerConnection.onicecandidate = (event) => {
    //         if (!event.candidate) return;
    //         candidates.push(event.candidate);
    //     }
    //     peerConnection.onicegatheringstatechange = async () => {
    //         if (peerConnection.iceGatheringState !== 'complete') return;
    //         ws.send(JSON.stringify({
    //             type: "data",
    //             to_peer_id: "camera",
    //             data: {
    //                 type: "offer_and_candidates",
    //                 offer: peerConnection.localDescription,
    //                 candidates,
    //             },
    //         }));
    //     }
    //     setPeerConnection(peerConnection)
    //     ws.onopen = async () => {
    //         ws.send(JSON.stringify({
    //             type: "register",
    //             register: {
    //                 id: "monitor",
    //                 peer_ids: ["camera"],
    //             },
    //         }));
    //         peerConnection.addTransceiver('video', { direction: 'recvonly' })
    //         peerConnection.addTransceiver('audio', { direction: 'recvonly' })
    //         const offer = await peerConnection.createOffer();
    //         await peerConnection.setLocalDescription(offer);
    //     }
    //     ws.onmessage = async (event) => {
    //         const frame = JSON.parse(event.data)
    //         const data = frame.data
    //         if (data.type !== 'answer') return
    //         await peerConnection.setRemoteDescription(data)
    //         ws.close()
    //     }
    // }, [])
    return (
        <div className="monitor">
            <button onClick={connect} className="btn btn-primary">
                Connect
            </button>
            {peerID && <Video peerID={peerID} />}
        </div>
    );
};

export default Monitor;