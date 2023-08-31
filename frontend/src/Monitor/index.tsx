import React from "react";
import { v4 as uuid } from "uuid";
import * as DeviceRegistrar from '../DeviceRegistrar'
import "./Monitor.scss";
import SelectCamera from "./SelectCamera";
import Video from "./Video";
import Connection from "./Connection";
import SessionDropdown from "../Sessions/SessionDropdown";
import SessionsMock from "../Sessions/SessionsMock";
import { Session } from "../Sessions/Sessions";

const isConnectionLost = (connectionState: RTCPeerConnectionState) => {
    if (connectionState === "disconnected") return true;
    if (connectionState === "failed") return true;
    if (connectionState === "closed") return true;
    return false;
}

const sessions = new SessionsMock();
sessions.start({
    client_id: uuid(),
    session_name: "Test Session",
});

const Monitor: React.FunctionComponent = () => {
    const client = DeviceRegistrar.useDevice();
    const [session, setSession] = React.useState<Session | null>(null);
    const [cameraID, setCameraID] = React.useState<string>("");
    const [connection, setConnection] = React.useState<Connection | null>(null);
    const [stream, setStream] = React.useState<MediaStream | null>(null);
    const [sessionEnded, setSessionEnded] = React.useState(false);
    const [connectionState, setConnectionState] = React.useState<RTCPeerConnectionState>("new");
    const [refreshKey, setRefreshKey] = React.useState("");

    const onCameraIDChange = React.useCallback((cameraID: string) => {
        setCameraID(cameraID);
        setStream(null);
        setSessionEnded(false);

        if (connection !== null) {
            connection.onclose = null;
            connection.close();
        }
        if (cameraID === "") return;

        const newConnection = new Connection(client.id, cameraID);
        newConnection.ontrack = (event: RTCTrackEvent) => {
            const stream = event.streams[0];
            setStream(stream);
        }
        newConnection.onconnectionstatechange = (event: Event) => {
            if (event.type !== "connectionstatechange") throw new Error("event.type is not connectionstatechange");
            const connection = event.target as RTCPeerConnection;
            setConnectionState(connection.connectionState);
        }
        newConnection.onclose = () => {
            setCameraID("");
            setStream(null);
            setSessionEnded(true);
            setRefreshKey(uuid());
        }
        setConnection(newConnection);
    }, [client.id, connection]);

    return (
        <div className="monitor">
            <SessionDropdown sessions={sessions} value={session} onChange={setSession} />
            <SelectCamera value={cameraID} onChange={onCameraIDChange} refreshKey={refreshKey} />
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
            {stream && (
                <Video
                    stream={stream}
                    key={cameraID}
                />
            )}
        </div>
    );
};

export default Monitor;