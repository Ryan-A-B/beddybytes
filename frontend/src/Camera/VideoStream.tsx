import React from "react";
import usePromise from "../hooks/usePromise";
import config from "../RTCConfig";

const websocketURL = "wss://10.64.227.111:8000/ws";

interface Props {
    videoDeviceID: string
}

const VideoStream: React.FunctionComponent<Props> = ({ videoDeviceID }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const getUserMedia = React.useMemo(() => {
        return navigator.mediaDevices.getUserMedia({
            video: { deviceId: videoDeviceID },
            audio: true,
        });
    }, [videoDeviceID]);
    const stream = usePromise(getUserMedia);
    React.useEffect(() => {
        if (stream.state !== 'resolved') return;
        if (videoRef.current === null) return;
        videoRef.current.srcObject = stream.value;
    }, [stream]);
    const [isStarted, setIsStarted] = React.useState(false);
    const onClick = React.useCallback(() => {
        setIsStarted(true);
    }, []);
    React.useEffect(() => {
        if (!isStarted) return;
        if (stream.state !== 'resolved') throw new Error('Stream is not resolved');
        const ws = new WebSocket(websocketURL);
        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: "register",
                register: {
                    id: "camera",
                    peer_ids: ["monitor"],
                },
            }));
        }
        ws.onmessage = async (event) => {
            console.log(event)
            const frame = JSON.parse(event.data);
            const data = frame.data;
            if (data.type !== "offer_and_candidates") return;
            const pc = new RTCPeerConnection(config);
            await pc.setRemoteDescription(data.offer);
            for (const candidate of data.candidates) {
                await pc.addIceCandidate(candidate);
            }
            stream.value.getTracks().forEach((track) => pc.addTrack(track, stream.value));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({
                type: "data",
                to_peer_id: frame.from_peer_id,
                data: answer,
            }));
        }
    }, [stream, isStarted]);
    if (stream.state === 'pending') return (<div>Getting stream...</div>)
    if (stream.state === 'rejected') return (<div>Failed to get stream: {stream.error.message}</div>)
    return (
        <React.Fragment>
            <video ref={videoRef} autoPlay playsInline muted />
            {!isStarted && (
                <button onClick={onClick} className="btn btn-primary">
                    Start
                </button>
            )}
        </React.Fragment>
    )
};

export default VideoStream;