import React from "react";
import YoutubeVideo from "../../YoutubeVideo"

import thumbnail from "./thumbnail.webp";

const DemoSection: React.FunctionComponent = () => {
    return (
        <section id="demo">
            <div className="container">
                <h2>Set up in under 5 minutes</h2>
                <div className="ratio ratio-16x9 mb-3">
                    <YoutubeVideo
                        video_id="uQHlMu7m5us"
                        title="Getting started video"
                        thumbnail={thumbnail}
                    />
                </div>
            </div>
        </section>
    )
}

export default DemoSection