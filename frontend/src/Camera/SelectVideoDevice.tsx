import React from "react";
import usePromise from "../hooks/usePromise";

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
    const promise = React.useMemo(() => {
        return navigator.mediaDevices.enumerateDevices()
            .then((devices) => devices.filter((device) => device.kind === 'videoinput'))
            .then(getUniqueDevices)
    }, []);
    const videoDevices = usePromise(promise);
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(event.target.value);
    }, [onChange]);
    if (videoDevices.state === 'pending') return (<div>Getting devices...</div>);
    if (videoDevices.state === 'rejected') return (<div>Failed to get devices</div>);
    return (
        <select value={value} onChange={handleChange} className="form-select" disabled={disabled}>
            <option value="">Select a video device</option>
            {videoDevices.value.map((device, i) => (
                <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${i + 1}`}
                </option>
            ))}
        </select>
    );
};

export default SelectVideoDevice;