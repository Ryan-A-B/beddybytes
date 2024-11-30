import React from "react";
import baby_station from "../../services/instances/baby_station";
import useServiceState from "../../hooks/useServiceState";

interface Props {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
}

const getUniqueDevices = (devices: MediaDeviceInfo[]): MediaDeviceInfo[] => {
    const deviceIDs: string[] = [];
    return devices.filter((device) => {
        if (deviceIDs.includes(device.deviceId)) return false;
        deviceIDs.push(device.deviceId);
        return true;
    });
}

const SelectVideoDevice: React.FunctionComponent<Props> = ({ value, onChange, disabled }) => {
    const media_device_service = baby_station.media_device_service;
    const media_device_state = useServiceState(media_device_service);
    const videoDevices = React.useMemo(() => {
        const videoDevices = media_device_state.devices.filter((device) => device.kind === 'videoinput');
        return getUniqueDevices(videoDevices);
    }, [media_device_state.devices]);
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(event.target.value);
    }, [onChange]);
    return (
        <select id="select-video-device" value={value} onChange={handleChange} className="form-select" disabled={disabled}>
            <option value="">No camera</option>
            {videoDevices.map((device, i) => (
                <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${i + 1}`}
                </option>
            ))}
        </select>
    );
};

export default SelectVideoDevice;