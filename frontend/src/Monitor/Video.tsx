import React from 'react';
import * as config from '../config';
import * as DeviceRegistrar from '../DeviceRegistrar';

interface Props {
    peerID: string
}

const Video: React.FunctionComponent<Props> = ({ peerID }) => {
    const device = DeviceRegistrar.useDevice();
    const videoRef = React.useRef<HTMLVideoElement>(null);
    React.useEffect(() => {
        if (videoRef.current === null)
            throw new Error("videoRef.current is null");
        const video = videoRef.current;
        const websocket = new WebSocket(`${config.websocketURL}/devices/${device.id}/websocket`);
        const peerConnection = new RTCPeerConnection(config.rtc);
        peerConnection.ontrack = (event) => {
            console.log(event)
            video.srcObject = event.streams[0];
            video.play();
        }
        peerConnection.onicecandidate = (event) => {
            console.log(event)
            if (!event.candidate) return;
            websocket.send(JSON.stringify({
                type: "data",
                to_peer_id: peerID,
                data: {
                    type: "candidate",
                    candidate: event.candidate,
                },
            }));
        }
        websocket.onopen = async (event) => {
            console.log(event)
            peerConnection.addTransceiver('video', { direction: 'recvonly' })
            peerConnection.addTransceiver('audio', { direction: 'recvonly' })
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            websocket.send(JSON.stringify({
                type: "data",
                to_peer_id: peerID,
                data: offer,
            }));
        }
        websocket.onmessage = async (event) => {
            console.log(event)
            const frame = JSON.parse(event.data);
            if (frame.type !== "data")
                throw new Error("frame.type is not data");
            const data = frame.data;
            if (data.type !== "answer")
                throw new Error("data.type is not answer");
            await peerConnection.setRemoteDescription(data);
            websocket.close();
        }
    }, [])
    return (
        <React.Fragment>
            Video: Peer ID: {peerID}
            <video ref={videoRef} playsInline className="video" />
        </React.Fragment>
    )
}

export default Video;