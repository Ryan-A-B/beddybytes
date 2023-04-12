import React from 'react';
import SelectVideoDevice from './SelectVideoDevice';
import VideoStream from './VideoStream';
import './Camera.scss';

const Camera: React.FunctionComponent = () => {
    const [videoDeviceID, setVideoDeviceID] = React.useState('');
    return (
        <main className="camera">
            <SelectVideoDevice value={videoDeviceID} onChange={setVideoDeviceID} />
            {videoDeviceID && <VideoStream videoDeviceID={videoDeviceID} />}
        </main>
    )
};

export default Camera;