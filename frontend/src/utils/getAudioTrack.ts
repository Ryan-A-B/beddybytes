const get_audio_track = (media_stream: MediaStream): MediaStreamTrack | null => {
    const audio_tracks = media_stream.getAudioTracks();
    if (audio_tracks.length !== 1) return null;
    return audio_tracks[0];
}

export default get_audio_track;
