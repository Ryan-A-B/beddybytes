import React from 'react';
import ConnectionState from './ConnectionState';
import logging_service from '../../services/instances/logging_service';
import { Severity } from '../../services/LoggingService';

const max_frame_rate = 12;
const max_frame_interval = 1000 / max_frame_rate;

const bar_gap = 2;

interface Props {
    stream: MediaStream
}

const AudioStream: React.FunctionComponent<Props> = ({ stream: media_stream }) => {
    const htmlAudioElementRef = React.useRef<HTMLAudioElement>(null);
    const canvasElementRef = React.useRef<HTMLCanvasElement>(null);
    React.useLayoutEffect(() => {
        if (htmlAudioElementRef.current === null)
            throw new Error("videoRef.current is null");
        const htmlAudioElement = htmlAudioElementRef.current
        htmlAudioElement.srcObject = media_stream;
        htmlAudioElement.play().catch((error) => {
            logging_service.log({
                severity: Severity.Error,
                message: `Failed to play audio: ${error}`
            })
        });
        return () => {
            htmlAudioElement.srcObject = null;
        }
    }, [media_stream])
    React.useLayoutEffect(() => {
        if (canvasElementRef.current === null)
            throw new Error("canvasElementRef.current is null");
        const canvasElement = canvasElementRef.current
        const canvasContext = canvasElement.getContext('2d');
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(media_stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let x = 0;
        let t0 = Date.now();
        let stop = false;
        function renderFrame() {
            if (stop) return;
            if (canvasContext === null)
                throw new Error("canvasContext is null");
            requestAnimationFrame(renderFrame);
            const dt = Date.now() - t0;
            if (dt < max_frame_interval) return;
            t0 = Date.now();
            x = 0;
            const barWidth = (canvasElement.width / bufferLength) - bar_gap;
            analyser.getByteFrequencyData(dataArray);
            canvasContext.fillStyle = 'rgb(33, 37, 41)';
            canvasContext.fillRect(0, 0, canvasElement.width, canvasElement.height);
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] * canvasElement.height / 256;
                canvasContext.fillStyle = `rgb(16, 16, 16)`;
                canvasContext.fillRect(x, canvasElement.height - barHeight, barWidth, barHeight);
                x += barWidth + bar_gap;
            }
        }
        renderFrame();
        return () => {
            stop = true;
            source.disconnect(analyser);
        }
    }, [media_stream])
    return (
        <React.Fragment>
            <p id="audio-only-message">Audio only</p>
            <ConnectionState stream={media_stream} />
            <audio id="audio-parent" ref={htmlAudioElementRef} />
            <canvas
                id="audio-visualizer"
                width={512}
                height={288}
                ref={canvasElementRef}
            />
        </React.Fragment>
    )
}

export default AudioStream;