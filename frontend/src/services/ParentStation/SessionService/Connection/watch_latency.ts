const little_endian = false;

const check_interval = 1000;

// typescript doesn't know about MediaStreamTrackProcessor or MediaStreamTrackGenerator
const watch_latency = (video_track: MediaStreamTrack) => {
    // @ts-ignore    
    if (MediaStreamTrackProcessor === undefined) return;
    if (video_track.kind !== "video") throw new Error("track.kind is not video");
    // @ts-ignore
    const track_processor = new MediaStreamTrackProcessor({ track: video_track });
    const reader = track_processor.readable.getReader();
    const read_frame = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
            console.log("done");
            return;
        }
        const video_frame = value as VideoFrame;
        console.log(video_frame.timestamp);
        video_frame.close();
        return read_frame();
    }
    read_frame();

    // const video_element = document.createElement("video");
    // video_element.muted = true;
    // video_element.srcObject = new MediaStream([track]);
    // video_element.play();

    // const canvas_element = document.createElement("canvas");
    // const context = canvas_element.getContext("2d");
    // if (context === null) throw new Error("Failed to get 2d context");

    // let last_check = Date.now();
    // const render = () => {
    //     if (track.readyState !== "live") return;
    //     requestAnimationFrame(render);
    //     if (Date.now() - last_check < check_interval) return;
    //     last_check = Date.now();

    //     canvas_element.width = video_element.videoWidth;
    //     canvas_element.height = video_element.videoHeight;

    //     context.drawImage(video_element, 0, 0);
    //     const image_data = context.getImageData(0, 0, 1, 1);
    //     console.log(image_data.data);
    // }
    // render();

    // const canvas_element = document.createElement("canvas");
    // canvas_element.width = width;
    // canvas_element.height = height;
    // const context = canvas_element.getContext("2d");
    // if (context === null) throw new Error("Failed to get 2d context");

    // const read_metadata = () => {
    //     read_magic();
    //     const version = read_version();
    //     console.log(version);

    //     // const bytes = new Uint8Array(8);
    //     // const image_data = context.getImageData(0, 0, 3, 1);
    //     // for (let i = 0; i < 10; i++) {
    //     //     const is_alpha_channel = i % 4 === 3;
    //     //     if (is_alpha_channel && image_data.data[i] !== 255) throw new Error('Invalid metadata');
    //     //     const offset = Math.floor(i / 4);
    //     //     bytes[i - offset] = image_data.data[i];
    //     // }
    //     // const data_view = new DataView(bytes.buffer);
    //     // const last_frame_unix_ms = Number(data_view.getBigUint64(0, little_endian));
    //     // const dt = Date.now() - last_frame_unix_ms;
    //     // console.log(`Last frame was ${dt}ms ago`);
    // }

    // const read_magic = () => {
    //     const image_data = context.getImageData(0, 0, 1, 1);
    //     console.log(image_data.data);
    //     if (image_data.data[0] !== 0x73) throw new Error(`Invalid magic: ${image_data.data[0]}`);
    //     if (image_data.data[1] !== 0x00) throw new Error(`Invalid magic: ${image_data.data[1]}`);
    //     if (image_data.data[2] !== 0x99) throw new Error(`Invalid magic: ${image_data.data[2]}`);
    // }

    // const read_version = (): number => {
    //     const image_data = context.getImageData(1, 0, 1, 1);
    //     const version = image_data.data[0] | image_data.data[1] << 8 | image_data.data[2] << 16;
    //     return version;
    // }

    // const read_data = (length: number) => {
    //     const data = new Uint8Array(length);
    //     const n_pixels = Math.ceil(length / 3);
    //     const image_data = context.getImageData(2, 0, n_pixels, 1);
    //     let i = 0;
    //     while (i < image_data.data.length) {
    //         const is_alpha_channel = i % 4 === 3;
    //         if (is_alpha_channel) {
    //             if (image_data.data[i] !== 255) throw new Error('Invalid data');
    //             i++;
    //             continue;
    //         }
    //         const byte_offset = Math.floor(i / 4);
    //         const byte_index = i - byte_offset;
    //         data[byte_index] = image_data.data[i];
    //         i++;
    //     }
    //     return data;
    // }

    // let last_check = Date.now();
    // const render = () => {
    //     requestAnimationFrame(render);
    //     if (Date.now() - last_check < check_interval) return;
    //     last_check = Date.now();
    //     context.drawImage(video_element, 0, 0);
    //     try {
    //         read_metadata();
    //     } catch (error) {
    //         console.error(error);
    //     }
    // };
    // render();
}

export default watch_latency;