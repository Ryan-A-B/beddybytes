import React from "react";
import { Link } from "react-router-dom";

const Instructions: React.FunctionComponent = () => {
    return (
        <React.Fragment>
            <h1>Instructions:</h1>
            <p>To successfully use this app, you will need a minimum of two devices: one to function as the camera and at least one to act as a monitor. Both devices must have internet access.</p>
            <h2>Camera:</h2>
            <ol>
                <li>Ensure that the camera device has a functioning camera.</li>
                <li>On the camera device, navigate to the <Link to="/camera">camera</Link> page.</li>
                <li>Select the desired camera from the dropdown menu.</li>
                <li>Click the "Start" button to initiate the camera session.</li>
            </ol>
            <h2>Monitor:</h2>
            <ol>
                <li>On each monitor device, navigate to the <Link to="/monitor">monitor</Link> page.</li>
                <li>Select the name of the camera device in the dropdown menu.</li>
            </ol>
            <aside className="alert alert-light" role="alert">
                <small>
                    <p>Please note that the dropdown menu will not display any cameras until the camera device has started a session. You can refresh the list of camera devices by clicking the designated button.</p>
                    <p>It is important to mute the monitor or place it far away from the camera to avoid any audio feedback during the session. The monitor will play sound along with the video feed.</p>
                    <p>Please note that this application is designed to operate primarily within a single local network. It may not function properly with devices on different networks.</p>
                    <p>After the camera and monitor establish the initial connection, all subsequent communication occurs directly between them in a peer-to-peer manner. The server's role is limited to facilitating the initial connection establishment process.</p>
                </small>
            </aside>
        </React.Fragment>

    );
}

export default Instructions;