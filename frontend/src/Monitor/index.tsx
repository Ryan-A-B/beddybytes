import React from "react";
import { v4 as uuid } from "uuid";
import * as DeviceRegistrar from '../DeviceRegistrar'
import "./Monitor.scss";
import SelectCamera from "./SelectCamera";
import Video from "./Video";
import Connection from "./Connection";

const isConnectionLost = (connectionState: RTCPeerConnectionState) => {
    if (connectionState === "disconnected") return true;
    if (connectionState === "failed") return true;
    if (connectionState === "closed") return true;
    return false;
}

const Monitor: React.FunctionComponent = () => {
    const client = DeviceRegistrar.useDevice();
    const [cameraID, setCameraID] = React.useState<string>("");
    const [stream, setStream] = React.useState<MediaStream | null>(null);
    const [sessionEnded, setSessionEnded] = React.useState(false);
    const [connectionState, setConnectionState] = React.useState<RTCPeerConnectionState>("new");
    const [refreshKey, setRefreshKey] = React.useState("");
    React.useEffect(() => {
        if (cameraID === "") return;
        setSessionEnded(false);
        setConnectionState("new");
        const connection = new Connection(client.id, cameraID);
        connection.ontrack = (event: RTCTrackEvent) => {
            const stream = event.streams[0];
            setStream(stream);
        };
        connection.onconnectionstatechange = (event: Event) => {
            if (event.type !== "connectionstatechange") throw new Error("event.type is not connectionstatechange");
            const connection = event.target as RTCPeerConnection;
            setConnectionState(connection.connectionState);
        };
        connection.onclose = () => {
            setCameraID("");
            setStream(null);
            setSessionEnded(true);
            setRefreshKey(uuid());
        };
    }, [client.id, cameraID])
    return (
        <div className="monitor">
            <SelectCamera value={cameraID} onChange={setCameraID} refreshKey={refreshKey} />
            {sessionEnded && (
                <div className="alert alert-danger" role="alert">
                    Session Ended
                </div>
            )}
            {!sessionEnded && isConnectionLost(connectionState) && (
                <div className="alert alert-danger" role="alert">
                    Connection Lost
                </div>
            )}
            {stream && <Video stream={stream} />}
        </div>
    );
};

export default Monitor;