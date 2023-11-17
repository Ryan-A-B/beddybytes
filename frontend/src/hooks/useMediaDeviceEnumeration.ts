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

export default useMediaDeviceEnumeration;
