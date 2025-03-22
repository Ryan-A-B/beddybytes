import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTag, faMicrophone, faVideo } from '@fortawesome/free-solid-svg-icons';
import { useSignalService } from '../../services';
import baby_station from '../../services/instances/baby_station';
import run_screen_saver from '../../services/BabyStation/ScreenSaver';
import SessionService from '../../services/BabyStation/SessionService';
import useMediaDevicesPermissionStatus from '../../hooks/useMediaDevicePermissionStatus';
import useWakeLock from '../../hooks/useWakeLock';
import useServiceState from '../../hooks/useServiceState';
import Input from '../../components/Input';
import SelectVideoDevice from './SelectVideoDevice';
import SelectAudioDevice from './SelectAudioDevice';
import MediaStream from './MediaStream';
import SessionToggle from './SessionToggle';
import MediaStreamPermissionCheck from './MediaStreamPermissionCheck';
import './style.scss';

const DefaultSessionName = 'Baby Station';

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

const useEndSessionOnUnmount = (session_service: SessionService) => {
    React.useEffect(() => {
        return () => {
            const host_session_status = session_service.get_state();
            if (host_session_status.name === 'session_running')
                session_service.end_session();
        }
    }, [session_service]);
}

const BabyStation: React.FunctionComponent = () => {
    const signal_service = useSignalService();
    const { session_service, media_device_service } = baby_station;
    const media_device_state = useServiceState(media_device_service);
    const baby_station_session_state = useServiceState(session_service);

    const media_devices_permission_state = useMediaDevicesPermissionStatus();
    const [sessionName, setSessionName] = useSessionName();
    React.useEffect(() => {
        if (media_devices_permission_state.state !== 'granted') return;
        media_device_service.start();
        return media_device_service.stop;
    }, [media_devices_permission_state, media_device_service]);
    const canActivateSession = React.useMemo(() => {
        return sessionName !== '';
    }, [sessionName]);
    useWakeLock(baby_station_session_state.name !== 'no_session_running');
    const startSession = React.useCallback(async () => {
        await session_service.start_session({
            connection_id: signal_service.connection_id,
            name: sessionName,
        });
    }, [session_service, signal_service, sessionName]);
    useEndSessionOnUnmount(session_service);
    return (
        <MediaStreamPermissionCheck media_device_permission_service={baby_station.media_device_permission_service}>
            <main className="container wrapper-content baby-station">
                <div className="row justify-content-center g-2 mb-3">
                    <div className="form-group col-sm-auto col-lg">
                        <div className="input-group">
                            <span className="input-group-text">
                                <FontAwesomeIcon icon={faTag} />
                            </span>
                            <Input
                                id="input-session-name"
                                value={sessionName}
                                onChange={setSessionName}
                                className="form-control"
                                disabled={baby_station_session_state.name !== 'no_session_running'}
                            />
                        </div>
                    </div>
                    <div className="form-group col-sm-auto col-lg">
                        <div className="input-group">
                            <span className="input-group-text">
                                <FontAwesomeIcon icon={faMicrophone} />
                            </span>
                            <SelectAudioDevice
                                value={media_device_state.audio_device_id}
                                onChange={media_device_service.set_audio_device_id}
                                disabled={baby_station_session_state.name !== 'no_session_running'}
                            />
                        </div>
                    </div>
                    <div className="form-group col-sm-auto col-lg">
                        <div className="input-group">
                            <span className="input-group-text">
                                <FontAwesomeIcon icon={faVideo} />
                            </span>
                            <SelectVideoDevice
                                value={media_device_state.video_device_id}
                                onChange={media_device_service.set_video_device_id}
                                disabled={baby_station_session_state.name !== 'no_session_running'}
                            />
                        </div>
                    </div>
                    <div className="form-group col col-md-auto">
                        <SessionToggle
                            baby_station_session_state={baby_station_session_state}
                            startSession={startSession}
                            endSession={session_service.end_session}
                            disabled={!canActivateSession}
                        />
                    </div>
                </div>
                <button
                    onClick={run_screen_saver}
                    disabled={baby_station_session_state.name !== 'session_running'}
                    className='btn btn-secondary mb-3 mx-auto'
                >
                    Screen Saver
                </button>
                <MediaStream
                    sessionActive={baby_station_session_state.name === 'session_running'}
                    key={media_device_state.video_device_id}
                />
            </main >
        </MediaStreamPermissionCheck>
    )
};

export default BabyStation;
