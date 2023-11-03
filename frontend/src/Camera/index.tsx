import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTag, faMicrophone, faVideo } from '@fortawesome/free-solid-svg-icons';

import getWakeLocker from '../WakeLock';
import Input from '../FormComponents/Input';
import useConnection from '../Connection/useConnection';
import { Session } from '../Sessions/Sessions';
import SessionsWriterAPI from '../Sessions/SessionsWriterAPI';
import SelectVideoDevice from './SelectVideoDevice';
import SelectAudioDevice from './SelectAudioDevice';
import MediaStream from './MediaStream';
import useVideoAndAudioPermission from './useVideoAndAudioPermission';
import SessionToggle from './SessionToggle';
import './Camera.scss';

const DefaultSessionName = 'Camera';

const LocalStorageAudioDeviceIDKey = 'audio_device_id';
const LocalStorageVideoDeviceIDKey = 'video_device_id';

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

const useSessionWakeLock = (session: Session | null) => {
    React.useEffect(() => {
        if (session === null) return;
        const wakeLocker = getWakeLocker();
        wakeLocker.lock();
        return wakeLocker.unlock;
    }, [session]);
}

const sessions = new SessionsWriterAPI();

const Camera: React.FunctionComponent = () => {
    const connection = useConnection();
    const permissionPromiseState = useVideoAndAudioPermission();
    const [sessionName, setSessionName] = useSessionName();
    const [audioDeviceID, setAudioDeviceID] = React.useState(() => {
        const audioDeviceID = localStorage.getItem(LocalStorageAudioDeviceIDKey);
        if (audioDeviceID === null) return '';
        return audioDeviceID;
    });
    const [videoDeviceID, setVideoDeviceID] = React.useState(() => {
        const videoDeviceID = localStorage.getItem(LocalStorageVideoDeviceIDKey);
        if (videoDeviceID === null) return '';
        return videoDeviceID;
    });
    const canActivateSession = React.useMemo(() => {
        if (sessionName === '') return false;
        if (audioDeviceID === '') return false;
        return true;
    }, [sessionName, videoDeviceID]);
    const [session, setSession] = React.useState<Session | null>(null);
    useSessionWakeLock(session);
    const setAudioDeviceIDAndStore = React.useCallback((audioDeviceID: string) => {
        localStorage.setItem(LocalStorageAudioDeviceIDKey, audioDeviceID);
        setAudioDeviceID(audioDeviceID);
    }, []);
    const setVideoDeviceIDAndStore = React.useCallback((videoDeviceID: string) => {
        localStorage.setItem(LocalStorageVideoDeviceIDKey, videoDeviceID);
        setVideoDeviceID(videoDeviceID);
    }, []);
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
            <div className="row justify-content-center g-2">
                <div className="form-group col-sm-auto col-lg">
                    <div className="input-group">
                        <span className="input-group-text">
                            <FontAwesomeIcon icon={faTag} />
                        </span>
                        <Input
                            value={sessionName}
                            onChange={setSessionName}
                            className="form-control"
                            disabled={session !== null}
                        />
                    </div>
                </div>
                <div className="form-group col-sm-auto col-lg">
                    <div className="input-group">
                        <span className="input-group-text">
                            <FontAwesomeIcon icon={faMicrophone} />
                        </span>
                        <SelectAudioDevice
                            value={audioDeviceID}
                            onChange={setAudioDeviceIDAndStore}
                            disabled={session !== null}
                        />
                    </div>
                </div>
                <div className="form-group col-sm-auto col-lg">
                    <div className="input-group">
                        <span className="input-group-text">
                            <FontAwesomeIcon icon={faVideo} />
                        </span>
                        <SelectVideoDevice
                            value={videoDeviceID}
                            onChange={setVideoDeviceIDAndStore}
                            disabled={session !== null}
                        />
                    </div>
                </div>
                <div className="form-group col col-md-auto">
                    <SessionToggle
                        session={session}
                        startSession={startSession}
                        endSession={endSession}
                        disabled={!canActivateSession}
                    />
                </div>
            </div>
            <MediaStream
                audioDeviceID={audioDeviceID}
                videoDeviceID={videoDeviceID}
                sessionActive={session !== null}
                key={videoDeviceID}
            />
        </main >
    )
};

export default Camera;
