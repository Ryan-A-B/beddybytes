import React from 'react';
import { PromiseState, InitialPromiseState } from '../pages/Camera/PromiseState';

const requestVideoAndAudioPermission = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach((track) => track.stop());
}

const useVideoAndAudioPermission = (): PromiseState<void> => {
    const [promiseState, setPromiseState] = React.useState<PromiseState<void>>(InitialPromiseState);
    React.useEffect(() => {
        requestVideoAndAudioPermission()
            .then(() => setPromiseState({ state: 'fulfilled', value: undefined }))
            .catch((error) => setPromiseState({ state: 'rejected', error }));
    }, []);
    return promiseState;
}

export default useVideoAndAudioPermission;
