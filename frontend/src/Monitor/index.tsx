import React from "react";
import "./Monitor.scss";
import SelectCamera from "./SelectCamera";
import Video from "./Video";

const Monitor: React.FunctionComponent = () => {
    const [cameraID, setCameraID] = React.useState<string>("");
    return (
        <div className="monitor">
            <SelectCamera value={cameraID} onChange={setCameraID}/>
            {cameraID && <Video peerID={cameraID} key={cameraID}/>}
        </div>
    );
};

export default Monitor;