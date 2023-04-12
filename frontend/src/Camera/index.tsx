import React from 'react';
import SelectVideoDevice from './SelectVideoDevice';
import VideoStream from './VideoStream';

const Camera: React.FunctionComponent = () => {
    const [videoDeviceID, setVideoDeviceID] = React.useState('');
    return (
        <React.Fragment>
            <SelectVideoDevice value={videoDeviceID} onChange={setVideoDeviceID} />
            {videoDeviceID && <VideoStream videoDeviceID={videoDeviceID} />}
        </React.Fragment>
    )
};

export default Camera;