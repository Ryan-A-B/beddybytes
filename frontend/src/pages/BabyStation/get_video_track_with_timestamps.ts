// typescript doesn't know about MediaStreamTrackProcessor

const get_video_track_with_timestamps = async (video_track: MediaStreamTrack) => {
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
}

export default get_video_track_with_timestamps;