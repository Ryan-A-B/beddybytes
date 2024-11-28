import React from "react";

const useMediaDeviceEnumeration = (): MediaDeviceInfo[] => {
    const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
    React.useEffect(() => {
        const handleDeviceChange = async () => {
            const media_stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            media_stream.getTracks().forEach((track) => track.stop());
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
