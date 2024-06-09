import React from "react";
import useMediaDeviceEnumeration from "../../hooks/useMediaDeviceEnumeration";

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

const SelectAudioDevice: React.FunctionComponent<Props> = ({ value, onChange, disabled }) => {
    const devices = useMediaDeviceEnumeration();
    const audioDevices = React.useMemo(() => {
        const audioDevices = devices.filter((device) => device.kind === 'audioinput');
        return getUniqueDevices(audioDevices);
    }, [devices]);
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(event.target.value);
    }, [onChange]);
    return (
        <select id="select-audio-device" value={value} onChange={handleChange} className="form-select" disabled={disabled}>
            <option value="">Default microphone</option>
            {audioDevices.map((device, i) => (
                <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${i + 1}`}
                </option>
            ))}
        </select>
    );
};

export default SelectAudioDevice;
