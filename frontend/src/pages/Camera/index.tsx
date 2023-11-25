import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTag, faMicrophone, faVideo } from '@fortawesome/free-solid-svg-icons';

import HostSessionService from '../../services/HostSessionService';
import media_device_permission_service from '../../instances/media_device_permission_service';
import host_session_service from '../../instances/host_session_service';
import useMediaDevicesPermissionStatus from '../../hooks/useMediaDevicePermissionStatus';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useWakeLock from '../../hooks/useWakeLock';
import useHostSessionStatus from '../../hooks/useHostSessionStatus';
import Input from '../../components/Input';
import SelectVideoDevice from './SelectVideoDevice';
import SelectAudioDevice from './SelectAudioDevice';
import MediaStream from './MediaStream';
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

const useEndSessionOnUnmount = (host_session_service: HostSessionService) => {
    React.useEffect(() => {
        return () => {
            const host_session_status = host_session_service.get_status();
            if (host_session_status.status === 'session_running')
                host_session_service.end_session();
        }
    }, [host_session_service]);
}

const Camera: React.FunctionComponent = () => {
    const connection_status = useConnectionStatus();
    const host_session_status = useHostSessionStatus();
    const media_devices_permission_status = useMediaDevicesPermissionStatus();
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
        return sessionName !== '';
    }, [sessionName]);
    useWakeLock(host_session_status.status !== 'no_session_running');
    const setAudioDeviceIDAndStore = React.useCallback((audioDeviceID: string) => {
        localStorage.setItem(LocalStorageAudioDeviceIDKey, audioDeviceID);
        setAudioDeviceID(audioDeviceID);
    }, []);
    const setVideoDeviceIDAndStore = React.useCallback((videoDeviceID: string) => {
        localStorage.setItem(LocalStorageVideoDeviceIDKey, videoDeviceID);
        setVideoDeviceID(videoDeviceID);
    }, []);
    const startSession = React.useCallback(async () => {
        if (connection_status.status === 'not_connected') throw new Error("connection is not connected");
        const connection = connection_status.connection;
        await host_session_service.start_session({
            connection_id: connection.id,
            name: sessionName,
        });
    }, [connection_status, sessionName]);
    useEndSessionOnUnmount(host_session_service);
    React.useEffect(() => {
        media_device_permission_service.requestVideoAndAudioPermission();
    }, []);
    if (media_devices_permission_status.status === 'requested') return (
        <div>
            Requesting permission to access camera and microphone...
        </div>
    );
    if (media_devices_permission_status.status === 'denied') return (
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
                            disabled={host_session_status.status !== 'no_session_running'}
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
                            disabled={host_session_status.status !== 'no_session_running'}
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
                            disabled={host_session_status.status !== 'no_session_running'}
                        />
                    </div>
                </div>
                <div className="form-group col col-md-auto">
                    <SessionToggle
                        host_session_status={host_session_status}
                        startSession={startSession}
                        endSession={host_session_service.end_session}
                        disabled={!canActivateSession}
                    />
                </div>
            </div>
            {media_devices_permission_status.status === 'granted' && (
                <MediaStream
                    audioDeviceID={audioDeviceID}
                    videoDeviceID={videoDeviceID}
                    sessionActive={host_session_status.status === 'session_running'}
                    key={videoDeviceID}
                />
            )}
        </main >
    )
};

export default Camera;
