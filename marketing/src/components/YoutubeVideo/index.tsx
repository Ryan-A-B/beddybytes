import React from 'react';
import icon from './youtube_icon.png';

interface Props {
    video_id: string
    title: string
    thumbnail: string
}

const IconStyle: React.CSSProperties = {
    width: "80px",
}

const YoutubeVideo: React.FunctionComponent<Props> = ({ video_id, title, thumbnail }) => {
    const [show, setShow] = React.useState(false)
    const switchToActualVideo = React.useCallback(() => {
        setShow(true)
    }, [])
    if (!show) return (
        <div
            onMouseOver={switchToActualVideo}
            onTouchStart={switchToActualVideo}
            className="w-100 h-100 bg-dark"
        >
            <img
                src={thumbnail}
                alt="thumbnail"
                className="w-100 h-100"
            />
            <img
                src={icon}
                alt="play"
                className="position-absolute top-50 start-50 translate-middle"
                style={IconStyle}
            />
        </div>
    )
    return (
        <iframe
            src={`https://www.youtube.com/embed/${video_id}`}
            title={title}
            className="w-100 h-100"
            allowFullScreen
        />
    )
}

export default YoutubeVideo;
