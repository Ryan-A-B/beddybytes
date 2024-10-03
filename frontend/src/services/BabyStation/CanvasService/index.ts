import moment from "moment";

const little_endian = false;
const colour_buffer = new Uint8Array(3);

interface CanvasCaptureMediaStream extends MediaStream {
    requestFrame?: () => void;
}

class CanvasService {
    private static padding = 10;
    private video_element: HTMLVideoElement;
    private canvas_element: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private output_video_track: MediaStreamTrack;
    private should_stop_rendering: boolean = false;

    constructor(media_stream: MediaStream) {
        console.log('CanvasService constructor');
        this.video_element = document.createElement('video');
        this.video_element.muted = true;
        this.video_element.srcObject = media_stream;
        this.video_element.play();

        const video_tracks = media_stream.getVideoTracks();
        // TODO handle audio only streams
        if (video_tracks.length !== 1) throw new Error('Expected exactly one video track');
        const video_track = video_tracks[0];
        const video_settings = video_track.getSettings();
        const video_width = video_settings.width;
        if (video_width === undefined) throw new Error('Failed to get video width');
        const video_height = video_settings.height;
        if (video_height === undefined) throw new Error('Failed to get video height');

        this.canvas_element = document.createElement('canvas');
        this.canvas_element.width = video_width;
        this.canvas_element.height = video_height;

        console.log({ width: video_width, height: video_height });

        const context = this.canvas_element.getContext('2d');
        if (context === null) throw new Error('Failed to get 2d context');
        this.context = context;

        const canvas_media_stream = this.canvas_element.captureStream() as CanvasCaptureMediaStream;
        const canvas_video_tracks = canvas_media_stream.getVideoTracks();
        if (canvas_video_tracks.length !== 1) throw new Error('Expected exactly one video track');
        this.output_video_track = canvas_video_tracks[0];

        this.render();
    }

    public get_video_track = (): MediaStreamTrack => {
        return this.output_video_track;
    }

    public stop_rendering = () => {
        this.should_stop_rendering = true;
    }

    private render = () => {
        if (this.should_stop_rendering) return;
        requestAnimationFrame(this.render);
        this.context.drawImage(this.video_element, 0, 0, this.canvas_element.width, this.canvas_element.height);
        // this.render_timestamp();
        this.render_metadata();
        // this.render_watermark();
    }

    private render_timestamp = () => {
        const timestamp = moment().format('HH:mm:ss');
        this.context.font = '16px Arial';
        this.context.fillStyle = 'rgba(255, 255, 255, 0.5)';
        const center = this.canvas_element.width / 2;
        const text_measurement = this.context.measureText(timestamp);
        const x = center - text_measurement.width / 2;
        const y = text_measurement.actualBoundingBoxAscent + CanvasService.padding;
        this.context.fillText(timestamp, x, y);
    }

    private render_metadata = () => {
        const now = Date.now();
        const bytes = new Uint8Array(8);
        const data_view = new DataView(bytes.buffer);
        data_view.setBigUint64(0, BigInt(now), little_endian);
        this.write_metadata(bytes);
    }

    private write_metadata = (bytes: Uint8Array) => {
        this.write_magic();
        this.write_version(0);
        const n_pixels = Math.ceil(bytes.length / 3);
        for (let pixel_index = 0; pixel_index < n_pixels; pixel_index++) {
            for (let j = 0; j < 3; j++) {
                const byte_index = pixel_index * 3 + j;
                if (byte_index >= bytes.length) break;
                colour_buffer[j] = bytes[byte_index];
            }
            this.write_pixel(pixel_index + 2);
        }
    }

    private write_magic = () => {
        colour_buffer[0] = 0x73;
        colour_buffer[1] = 0x00;
        colour_buffer[2] = 0x99;
        this.write_pixel(0);
    }

    private write_version = (version: number) => {
        colour_buffer[0] = version & 0xff;
        colour_buffer[1] = version >> 8 & 0xff;
        colour_buffer[2] = version >> 16 & 0xff;
        this.write_pixel(1);
    }

    private write_pixel = (pixel_index: number) => {
        this.context.fillStyle = `rgb(${colour_buffer[0]}, ${colour_buffer[1]}, ${colour_buffer[2]})`;
        this.context.fillRect(pixel_index, 0, 1, 1);
    }

    private render_watermark = () => {
        const watermark = 'BeddyBytes';
        this.context.font = '16px Arial';
        this.context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        const x = this.canvas_element.width - CanvasService.padding - this.context.measureText(watermark).width
        const y = this.canvas_element.height - CanvasService.padding;
        this.context.fillText(watermark, x, y);
    }

    // TODO move to parent station
    private read_metadata = () => {
        const bytes = new Uint8Array(8);
        const image_data = this.context.getImageData(0, 0, 3, 1);
        for (let i = 0; i < 10; i++) {
            const is_alpha_channel = i % 4 === 3;
            if (is_alpha_channel && image_data.data[i] !== 255) throw new Error('Invalid metadata');
            const offset = Math.floor(i / 4);
            bytes[i - offset] = image_data.data[i];
        }
        const data_view = new DataView(bytes.buffer);
        const last_frame_unix_ms = Number(data_view.getBigUint64(0, little_endian));
        const dt = Date.now() - last_frame_unix_ms;
        console.log(`Last frame was ${dt}ms ago`);
    }

    private read_magic = () => {
        const image_data = this.context.getImageData(0, 0, 1, 1);
        if (image_data.data[0] !== 0x73) throw new Error('Invalid magic');
        if (image_data.data[1] !== 0x00) throw new Error('Invalid magic');
        if (image_data.data[2] !== 0x99) throw new Error('Invalid magic');
    }

    private read_version = () => {
        const image_data = this.context.getImageData(1, 0, 1, 1);
        const version = image_data.data[0] | image_data.data[1] << 8 | image_data.data[2] << 16;
        return version;
    }

    private read_data = (length: number) => {
        const data = new Uint8Array(length);
        const n_pixels = Math.ceil(length / 3);
        const image_data = this.context.getImageData(2, 0, n_pixels, 1);
        let i = 0;
        while (i < image_data.data.length) {
            const is_alpha_channel = i % 4 === 3;
            if (is_alpha_channel) {
                if (image_data.data[i] !== 255) throw new Error('Invalid data');
                i++;
                continue;
            }
            const byte_offset = Math.floor(i / 4);
            const byte_index = i - byte_offset;
            data[byte_index] = image_data.data[i];
            i++;
        }
        return data;
    }
}

export default CanvasService;
