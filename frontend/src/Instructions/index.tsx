import React from "react";
import { Link } from "react-router-dom";

const Instructions: React.FunctionComponent = () => {
    return (
        <div className="row align-items-center">
            <div className="col-12 col-xl order-xl-2">
                <div className="ratio ratio-16x9">
                    <iframe
                        src="https://www.youtube.com/embed/AuUb7thmu80?si=IEg92DaB-DnvrZof"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-100 h-100"
                    ></iframe>
                </div>
            </div>
            <div className="col order-xl-1">
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
            </div>
        </div>
    );
}

export default Instructions;