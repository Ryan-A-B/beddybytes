import { List } from "immutable";
import get_audio_track from "../utils/getAudioTrack";

const BootstrapGrayDark = '#343a40';
const BootstrapGray = '#6c757d';

const get_log_frequency_bins = (num_bins: number, min_frequency: number, max_frequency: number): List<number> => {
    const log_min = Math.log10(min_frequency);
    const log_max = Math.log10(max_frequency);
    const log_range = log_max - log_min;
    const log_step = log_range / num_bins;
    return List<number>().withMutations((frequency_bins) => {
        for (let i = 0; i < num_bins; i++) {
            frequency_bins.push(Math.pow(10, log_min + log_step + (i * log_step)));
        }
    });
}

class HistogramService {
    private static MinFrequency = 10;
    private static MaxFrequency = 1000;
    private static NumBins = 64;
    private static LogFrequencyBins = get_log_frequency_bins(
        HistogramService.NumBins,
        HistogramService.MinFrequency,
        HistogramService.MaxFrequency,
    );
    private static FourierFastTransformSize = 256;
    private static Canvas = {
        Width: 640,
        Height: 480,
    }

    public static transform_media_stream = (media_stream: MediaStream): MediaStream => {
        const canvas = document.createElement('canvas');
        const canvas_ctx = canvas.getContext('2d');
        if (canvas_ctx === null) throw new Error('Could not get canvas context');
        canvas.width = HistogramService.Canvas.Width;
        canvas.height = HistogramService.Canvas.Height;

        const audio_context = new AudioContext();
        const sample_rate = audio_context.sampleRate;
        const max_frequency = sample_rate / 2;

        const analyser = audio_context.createAnalyser();
        const source = audio_context.createMediaStreamSource(media_stream);
        source.connect(analyser);
        analyser.fftSize = HistogramService.FourierFastTransformSize;
        const buffer_length = analyser.frequencyBinCount;
        const data_array = new Uint8Array(buffer_length);
        const bar_width = canvas.width / HistogramService.NumBins;

        const render_frame = (): void => {
            if (media_stream.active === false) return;

            canvas_ctx.fillStyle = BootstrapGrayDark;
            canvas_ctx.fillRect(0, 0, canvas.width, canvas.height);

            analyser.getByteFrequencyData(data_array);

            const bins = List<number>().withMutations((log_bins) => {
                let bin_index = 0;
                let bin_frequency = HistogramService.LogFrequencyBins.get(bin_index);
                if (bin_frequency === undefined) throw new Error('Could not get bin frequency');
                let value = 0;
                for (let i = 0; i < HistogramService.FourierFastTransformSize; i++) {
                    const frequency = i * max_frequency / HistogramService.FourierFastTransformSize;
                    if (frequency > bin_frequency) {
                        bin_index++;
                        if (bin_index >= HistogramService.NumBins) return;
                        bin_frequency = HistogramService.LogFrequencyBins.get(bin_index);
                        if (bin_frequency === undefined) throw new Error('Could not get bin frequency');
                        log_bins.push(value);
                        value = data_array[i];
                        continue;
                    }
                    value = Math.max(value, data_array[i]);
                }
            });

            bins.forEach((bin, index) => {
                const x = index * bar_width;
                const bin_decimal = bin / 255;
                const y = canvas.height - bin_decimal * canvas.height;
                const height = bin_decimal * canvas.height;
                canvas_ctx.fillStyle = BootstrapGray;
                canvas_ctx.fillRect(x, y, bar_width, height);
            });

            requestAnimationFrame(render_frame);
        }
        render_frame();

        const media_stream_with_histogram = canvas.captureStream();
        const end_media_stream_with_histogram = (): void => {
            media_stream_with_histogram.getTracks().forEach(track => track.stop());
        }

        const audio_track = get_audio_track(media_stream);
        if (audio_track === null) throw new Error('Could not get audio track');
        audio_track.addEventListener('ended', end_media_stream_with_histogram);
        media_stream_with_histogram.addTrack(audio_track.clone());

        return media_stream_with_histogram;
    }
}

export default HistogramService;
