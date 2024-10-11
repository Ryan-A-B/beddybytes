import React from 'react';
import useServiceState from '../../../hooks/useServiceState';
import MediaDevicePermissionService, { MediaDevicePermissionStatus } from '../../../services/BabyStation/MediaDevicePermissionService';

import './style.scss';

interface Props {
    media_device_permission_service: MediaDevicePermissionService
    children: React.ReactNode
}

// If MediaDevicePermissionService is unable to determine the permission status
// using navigator.permissions.query, it will set the state to 'unknown'. There
// is a trade off with what we do in the unknown state. We could treat it the
// same as 'not_requested' and wait for the user to click continue. However,
// this would be annoying if the user has already granted permission and we
// require them to click a button every time. I've instead chosen to request
// permission immediately if the state is 'unknown'. This will cause the
// browser to attempt to getUserMedia as soon as the user visits the page. If
// the user has already granted or denied permission, the browser will not
// prompt the user again.

const MediaStreamPermissionCheck: React.FunctionComponent<Props> = ({ media_device_permission_service, children }) => {
    const media_device_permission_state = useServiceState<MediaDevicePermissionStatus>(media_device_permission_service);
    React.useEffect(() => {
        if (media_device_permission_state.state === 'unknown')
            media_device_permission_service.request_video_and_audio_permission();
    }, [media_device_permission_service, media_device_permission_state]);
    if (media_device_permission_state.state === 'unknown') return null;
    if (media_device_permission_state.state === 'prompt') return (
        <div id="media-stream-permission-check" className="container wrapper-content">
            <h2 className="fs-4">
                Ready to start?
            </h2>
            <p>
                To use this device as a Baby Station, BeddyBytes needs to access
                the microphone and camera.
            </p>
            <button
                type="button"
                onClick={media_device_permission_service.request_video_and_audio_permission}
                id="button-continue-media-stream-permission-check"
                className="btn btn-primary"
            >
                Continue
            </button>
        </div>
    )
    if (media_device_permission_state.state === 'prompted') return (
        <div id="media-stream-permission-check" className="container wrapper-content">
            <h2 className="fs-4">
                Permission Requested
            </h2>
            <p>
                Please allow access to the camera and
                microphone to continue.
            </p>
        </div>
    );
    if (media_device_permission_state.state === 'denied') return (
        <div id="media-stream-permission-check" className="container wrapper-content">
            <h2 className="fs-4">
                Permission denied
            </h2>
            <p>
                Permission denied. If you wish to use to use this device as a Baby
                Station, please grant access to the microphone and camera.
            </p>
        </div>
        // TODO mention that having the baby station open in multiple tabs can
        // cause issues
    );
    if (media_device_permission_state.state === 'granted') return (
        <React.Fragment>
            {children}
        </React.Fragment>
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _exhaustive_check: never = media_device_permission_state;
    throw new TypeError(`Unexpected media device permission state: ${(media_device_permission_state as MediaDevicePermissionStatus).state}`);
}

export default MediaStreamPermissionCheck;
