import React from 'react';
import AudioVisualiser from '../../services/ParentStation/AudioVisualiser';

interface Props extends React.DetailedHTMLProps<React.CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement> {
    media_stream: MediaStream;
}

const AudioVisualiserComponent: React.FunctionComponent<Props> = ({ media_stream, ...canvas_props }) => {
    const canvasRef = React.useRef(null);
    React.useLayoutEffect(() => {
        const canvas_element = canvasRef.current;
        if (!canvas_element) return;
        const audio_visualiser = new AudioVisualiser({ media_stream, canvas_element });
        return () => audio_visualiser.close();
    }, [media_stream]);
    return (
        <canvas ref={canvasRef} {...canvas_props} />
    )
}

export default AudioVisualiserComponent;
