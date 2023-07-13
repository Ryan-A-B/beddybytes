import React from 'react';
import Input from '../FormComponents/Input';
import Checkbox from '../FormComponents/Checkbox';
import SelectVideoDevice from './SelectVideoDevice';
import VideoStream from './VideoStream';
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

const getCheckboxLabelClassName = (sessionActive: boolean) => {
    if (sessionActive) return 'btn btn-danger w-100';
    return 'btn btn-primary w-100';
}

const Camera: React.FunctionComponent = () => {
    const [sessionName, setSessionName] = useSessionName();
    const [videoDeviceID, setVideoDeviceID] = React.useState('');
    const [sessionActive, setSessionActive] = React.useState(false);
    const canActivateSession = React.useMemo(() => {
        if (sessionName === '') return false;
        if (videoDeviceID === '') return false;
        return true;
    }, [sessionName, videoDeviceID]);
    const onSessionActiveChange = React.useCallback((sessionActive: boolean) => {
        setSessionActive(sessionActive);
        if (sessionActive) return;
        setVideoDeviceID('');
    }, []);
    return (
        <main className="camera">
            <div className="row align-items-center g-2">
                <div className="form-group col-sm">
                    <Input
                        value={sessionName}
                        onChange={setSessionName}
                        className="form-control"
                        disabled={sessionActive}
                    />
                </div>
                <div className="form-group col">
                    <SelectVideoDevice
                        value={videoDeviceID}
                        onChange={setVideoDeviceID}
                        disabled={sessionActive}
                    />
                </div>
                <div className="form-group col-lg-1 col-sm-2 col-3">
                    <Checkbox
                        id="input-session-active"
                        value={sessionActive}
                        onChange={onSessionActiveChange}
                        className="btn-check"
                        disabled={!canActivateSession}
                    />
                    <label htmlFor="input-session-active" className={getCheckboxLabelClassName(sessionActive)}>
                        {sessionActive ? 'Stop' : 'Start'}
                    </label>
                </div>
            </div>
            {videoDeviceID && (
                <VideoStream
                    videoDeviceID={videoDeviceID}
                    sessionName={sessionName}
                    sessionActive={sessionActive}
                    key={videoDeviceID}
                />
            )}
        </main >
    )
};

export default Camera;
