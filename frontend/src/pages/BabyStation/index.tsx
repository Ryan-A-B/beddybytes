import React from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTag, faMicrophone, faVideo, faCog, faEdit } from '@fortawesome/free-solid-svg-icons';
import { useSignalService } from '../../services';
import baby_station from '../../services/instances/baby_station';
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

const get_audio_device_label = (devices: MediaDeviceInfo[], audio_device_id: string) => {
    if (audio_device_id === '') return 'Default mic';
    const audio_device = devices.find((device) => device.deviceId === audio_device_id);
    return audio_device?.label || audio_device_id;
}

const get_video_device_label = (devices: MediaDeviceInfo[], video_device_id: string) => {
    if (video_device_id === '') return 'No camera';
    const video_device = devices.find((device) => device.deviceId === video_device_id);
    return video_device?.label || video_device_id;
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

    const [showConfigurationPanel, setShowConfigurationPanel] = React.useState(false);
    const toggle_configuration_panel = React.useCallback(() => {
        setShowConfigurationPanel(!showConfigurationPanel);
    }, [showConfigurationPanel]);

    return (
        <MediaStreamPermissionCheck media_device_permission_service={baby_station.media_device_permission_service}>
            <main id="baby-station" className="container wrapper-content">
                <div className="baby-station-configuration">
                    <div className="alert alert-translucent configuration-summary">
                        <FontAwesomeIcon icon={faTag} />
                        <div className="flex-fill">
                            <span className="session-name">
                                {sessionName}
                            </span>
                            <div>
                                <span className="audio-device">
                                    <FontAwesomeIcon icon={faMicrophone} /> {get_audio_device_label(media_device_state.devices, media_device_state.audio_device_id)}
                                </span>
                                &nbsp;
                                <span className="video-device">
                                    <FontAwesomeIcon icon={faVideo} /> {get_video_device_label(media_device_state.devices, media_device_state.video_device_id)}
                                </span>
                            </div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={toggle_configuration_panel}>
                            <FontAwesomeIcon icon={faCog} />
                        </button>
                    </div>
                </div>
                <div className="baby-station-media">
                    <MediaStream
                        sessionActive={baby_station_session_state.name === 'session_running'}
                        key={media_device_state.video_device_id}
                    />
                </div>
                <SessionToggle
                    baby_station_session_state={baby_station_session_state}
                    startSession={startSession}
                    endSession={session_service.end_session}
                    disabled={!canActivateSession}
                />
                <button
                    onClick={baby_station.screen_saver_service.start}
                    disabled={baby_station_session_state.name !== 'session_running'}
                    className='btn btn-secondary screensaver-toggle'
                >
                    Screen Saver
                </button>
                <div className={`configuration-panel py-3 ${showConfigurationPanel ? 'active' : ''}`}>
                    <div className="configuration-panel-header">
                        <h4 className="fs-4">
                            <FontAwesomeIcon icon={faTag} />
                            &nbsp;
                            Baby Station
                        </h4>
                        <button type="button"
                            className="btn-close"
                            aria-label="Close"
                            onClick={toggle_configuration_panel}
                        ></button>
                    </div>
                    <div>
                        <h5 className="fs-6 fw-light">Station Name</h5>
                        <div className="form-group mb-3">
                            <div className="input-group">
                                <Input
                                    id="input-session-name"
                                    value={sessionName}
                                    onChange={setSessionName}
                                    className="form-control"
                                    disabled={baby_station_session_state.name !== 'no_session_running'}
                                />
                                <span className="input-group-text">
                                    <FontAwesomeIcon icon={faEdit} />
                                </span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h5 className="fs-6 fw-light">Devices</h5>
                        <div className="form-group mb-1">
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
                        <div className="form-group mb-4">
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
                    </div>
                    <button className="btn btn-primary w-100" onClick={toggle_configuration_panel}>
                        Done
                    </button>
                </div>
            </main >
        </MediaStreamPermissionCheck >
    )
};

export default BabyStation;
