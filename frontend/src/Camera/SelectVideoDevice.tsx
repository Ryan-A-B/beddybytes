import React from "react";

const useMediaDeviceEnumeration = (): MediaDeviceInfo[] => {
    const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
    React.useEffect(() => {
        const handleDeviceChange = async () => {
            const devices = await navigator.mediaDevices.enumerateDevices()
            setDevices(devices);
        };
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        handleDeviceChange();
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, []);
    return devices;
}

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
    const devices = useMediaDeviceEnumeration();
    const videoDevices = React.useMemo(() => {
        const videoDevices = devices.filter((device) => device.kind === 'videoinput');
        return getUniqueDevices(videoDevices);
    }, [devices]);
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(event.target.value);
    }, [onChange]);
    return (
        <select value={value} onChange={handleChange} className="form-select" disabled={disabled}>
            <option value="">Select a video device</option>
            {videoDevices.map((device, i) => (
                <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${i + 1}`}
                </option>
            ))}
        </select>
    );
};

export default SelectVideoDevice;