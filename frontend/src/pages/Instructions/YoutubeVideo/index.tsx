import React from 'react';
import icon from './youtube_icon.png';
import './style.scss';

interface Props {
    src: string
    title: string
    thumbnail: string
}

const YoutubeVideo: React.FunctionComponent<Props> = ({ src, title, thumbnail }) => {
    const [show, setShow] = React.useState(false)
    const switchToActualVideo = React.useCallback(() => {
        setShow(true)
    }, [])
    if (!show) return (
        <div
            onMouseOver={switchToActualVideo}
            onTouchStart={switchToActualVideo}
            className="youtube-video bg-dark"
        >
            <img
                src={thumbnail}
                alt="thumbnail"
                className="youtube-video-thumbnail"
            />
            <img
                src={icon}
                alt="play"
                className="youtube-video-icon position-absolute top-50 start-50 translate-middle"
            />
        </div>
    )
    return (
        <iframe
            src={src}
            title={title}
            className="w-100 h-100"
            allowFullScreen
        />
    )
}

export default YoutubeVideo;
