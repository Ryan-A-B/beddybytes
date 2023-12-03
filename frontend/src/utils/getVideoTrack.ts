const get_video_track = (media_stream: MediaStream): MediaStreamTrack | null => {
    const video_tracks = media_stream.getVideoTracks();
    if (video_tracks.length !== 1) return null;
    return video_tracks[0];
}

export default get_video_track;
