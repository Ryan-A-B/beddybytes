interface NewAudioVisualiserInput {
    media_stream: MediaStream;
    canvas_element: HTMLCanvasElement;
}

class AudioVisualiser {
    private static max_frame_rate = 12;
    private static max_frame_interval: number = 1000 / AudioVisualiser.max_frame_rate;
    private static bar_gap = 2;

    private canvas_element: HTMLCanvasElement;
    private canvas_context: CanvasRenderingContext2D;

    private audio_context: AudioContext
    private audio_source: MediaStreamAudioSourceNode;
    private audio_analyser: AnalyserNode;
    private data_array: Uint8Array;

    private done: boolean = false;
    private last_frame_time: number;

    constructor(input: NewAudioVisualiserInput) {
        this.canvas_element = input.canvas_element;
        const canvas_context = this.canvas_element.getContext('2d');
        if (!canvas_context)
            throw new Error('Could not get 2d context from canvas element');
        this.canvas_context = canvas_context;

        this.audio_context = new AudioContext();
        this.audio_source = this.audio_context.createMediaStreamSource(input.media_stream);
        this.audio_analyser = this.audio_context.createAnalyser();
        this.audio_analyser.fftSize = 64;
        this.audio_source.connect(this.audio_analyser);
        this.data_array = new Uint8Array(this.audio_analyser.frequencyBinCount);

        this.render_frame();
        this.last_frame_time = Date.now();
        this.render_frame_if_needed();
    }

    public close = () => {
        this.done = true;
        this.audio_source.disconnect();
        this.audio_analyser.disconnect();
        this.audio_context.close();
    }

    private render_frame_if_needed = () => {
        if (this.done === true) return;
        requestAnimationFrame(this.render_frame_if_needed);
        const dt = Date.now() - this.last_frame_time;
        if (dt < AudioVisualiser.max_frame_interval) return;
        this.render_frame();
        this.last_frame_time = Date.now();
    }

    private render_frame = () => {
        const canvas_width = this.canvas_element.width;
        const canvas_height = this.canvas_element.height;
        const total_bar_gap = AudioVisualiser.bar_gap * (this.data_array.length - 1);
        const bar_width = (canvas_width - total_bar_gap) / this.data_array.length;
        this.audio_analyser.getByteFrequencyData(this.data_array);
        this.canvas_context.fillStyle = 'rgb(33, 37, 41)';
        this.canvas_context.fillRect(0, 0, canvas_width, canvas_height);
        let x = 0;
        for (let i = 0; i < this.data_array.length; i++) {
            const bar_height = (this.data_array[i] + 5) * canvas_height / 256;
            this.canvas_context.fillStyle = `rgb(16, 16, 16)`;
            this.canvas_context.fillRect(x, canvas_height - bar_height, bar_width, bar_height);
            x += bar_width + AudioVisualiser.bar_gap;
        }
    }
}

export default AudioVisualiser;
