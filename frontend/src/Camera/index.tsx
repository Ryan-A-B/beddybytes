import React from 'react';
import Input from '../FormComponents/Input';
import useConnection from '../Connection/useConnection';
import { Session } from '../Sessions/Sessions';
import SessionsWriterAPI from '../Sessions/SessionsWriterAPI';
import SelectVideoDevice from './SelectVideoDevice';
import VideoStream from './VideoStream';
import useVideoAndAudioPermission from './useVideoAndAudioPermission';
import SessionToggle from './SessionToggle';
import './Camera.scss';

const DefaultSessionName = 'Camera';

const useSessionName = () => {
    const [sessionName, setSessionName] = React.useState(() => {
        const sessionName = localStorage.getItem('session_name');
        if (sessionName === null) return DefaultSessionName;
        return sessionName;
    });
    const setAndStoreSessionName = React.useCallback((sessionName: string) => {
        localStorage.setItem('session_name', sessionName);
        setSessionName(sessionName);
    }, []);
    return [sessionName, setAndStoreSessionName] as const;
}

const sessions = new SessionsWriterAPI();

const Camera: React.FunctionComponent = () => {
    const connection = useConnection();
    const permissionPromiseState = useVideoAndAudioPermission();
    const [sessionName, setSessionName] = useSessionName();
    const [videoDeviceID, setVideoDeviceID] = React.useState('');
    const canActivateSession = React.useMemo(() => {
        if (sessionName === '') return false;
        if (videoDeviceID === '') return false;
        return true;
    }, [sessionName, videoDeviceID]);
    const [session, setSession] = React.useState<Session | null>(null);
    const startSession = React.useCallback(async () => {
        const session = await sessions.start({
            host_connection_id: connection.id,
            session_name: sessionName,
        });
        setSession(session);
    }, [connection.id, sessions, sessionName]);
    const endSession = React.useCallback(async () => {
        if (session === null) throw new Error("session is null");
        await sessions.end({
            session_id: session.id,
        });
        setVideoDeviceID('');
        setSession(null);
    }, [sessions, session]);
    if (permissionPromiseState.state === 'pending') return (
        <div>
            Requesting permission to access camera and microphone...
        </div>
    );
    if (permissionPromiseState.state === 'rejected') return (
        <div>
            Permission to access camera and microphone denied. To use this device as a camera, please allow access to the camera and microphone.
        </div>
    );
    return (
        <main className="camera">
            <div className="row align-items-center g-2">
                <div className="form-group col-sm">
                    <Input
                        value={sessionName}
                        onChange={setSessionName}
                        className="form-control"
                        disabled={session !== null}
                    />
                </div>
                <div className="form-group col">
                    <SelectVideoDevice
                        value={videoDeviceID}
                        onChange={setVideoDeviceID}
                        disabled={session !== null}
                    />
                </div>
                <div className="form-group col-lg-1 col-sm-2 col-3">
                    <SessionToggle
                        session={session}
                        startSession={startSession}
                        endSession={endSession}
                        disabled={!canActivateSession}
                    />
                </div>
            </div>
            {videoDeviceID && (
                <VideoStream
                    videoDeviceID={videoDeviceID}
                    sessionActive={session !== null}
                    key={videoDeviceID}
                />
            )}
        </main >
    )
};

export default Camera;
