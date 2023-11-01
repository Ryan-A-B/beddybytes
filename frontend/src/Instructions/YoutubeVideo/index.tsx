import React from 'react';
import icon from './youtube_icon.png';

interface Props {
    src: string
    title: string
    thumbnail: string
}

const IconStyle: React.CSSProperties = {
    width: "80px",
}

const YoutubeVideo: React.FunctionComponent<Props> = ({ src, title, thumbnail }) => {
    const [show, setShow] = React.useState(false)
    const onMouseOver = React.useCallback(() => {
        setShow(true)
    }, [])
    if (!show) return (
        <div
            onMouseOver={onMouseOver}
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
            src={src}
            title={title}
            className="w-100 h-100"
        />
    )
}

export default YoutubeVideo;

{/* <iframe
            src="https://www.youtube.com/embed/AuUb7thmu80?si=IEg92DaB-DnvrZof"
            title="YouTube video player"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-100 h-100"
        ></iframe> */}