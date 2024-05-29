import React from "react";
import { Link } from "react-router-dom";
import YoutubeVideo from "./YoutubeVideo";
import thumbnail from "./thumbnail.webp";

const Instructions: React.FunctionComponent = () => {
    return (
        <div className="container">
            <div id="page-index" className="row align-items-center">
                <div className="col-12 col-xl order-xl-2">
                    <div className="ratio ratio-16x9 mb-3">
                        <YoutubeVideo
                            src="https://www.youtube.com/embed/uQHlMu7m5us?si=1xPX1d1_lSUaFBYB"
                            title="YouTube video player"
                            thumbnail={thumbnail}
                        />
                    </div>
                </div>
                <div className="col order-xl-1">
                    <h1>Instructions:</h1>
                    <p>To successfully use this app, you will need a minimum of two devices: one to function as the baby station and at least one to act as a parent station. Both devices must have internet access.</p>
                    <h2>Baby Station:</h2>
                    <ol>
                        <li>Ensure that the baby station has a functioning microphone and optionally a camera.</li>
                        <li>On the baby station, navigate to the <Link to="/baby">baby station</Link> page.</li>
                        <li>Select the desired microphone and camera from the dropdown menu.</li>
                        <li>Click the "Start" button to initiate the session.</li>
                    </ol>
                    <h2>Parent Station:</h2>
                    <ol>
                        <li>On each parent station, navigate to the <Link to="/parent">parent station</Link> page.</li>
                        <li>Select the name of the session from the dropdown menu.</li>
                    </ol>
                    <aside className="alert alert-light" role="alert">
                        <small>
                            <p>Please note that the dropdown menu will not display any sessions until the baby station has started a session. You can refresh the list of sessions by clicking the designated button.</p>
                            <p>It is important to mute the parent station or place it far away from the baby station to avoid any audio feedback during the session. The parent station will play sound along with the video feed.</p>
                            <p>Please note that this application is designed to operate primarily within a single local network. It will not function properly with devices on different networks.</p>
                            <p>After the baby and parent stations have established a connection, all subsequent communication occurs directly between them in a peer-to-peer manner. The server's role is limited to facilitating the initial connection establishment process.</p>
                        </small>
                    </aside>
                </div>
            </div>
        </div>
    );
}

export default Instructions;