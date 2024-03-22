const add_audio_noise = (media_stream: MediaStream): MediaStream => {
    const audio_context = new AudioContext();
    const source = audio_context.createMediaStreamSource(media_stream);

    const noise = audio_context.createGain();
    noise.gain.value = 0.0002;

    const noise_source = audio_context.createBufferSource();
    const buffer_size = audio_context.sampleRate * 2;
    const buffer = audio_context.createBuffer(1, buffer_size, audio_context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer_size; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noise_source.buffer = buffer;
    noise_source.loop = true;
    noise_source.connect(noise);
    noise_source.start();

    const combined = audio_context.createMediaStreamDestination();
    source.connect(combined);
    noise.connect(combined);

    media_stream.getVideoTracks().forEach((track) => {
        combined.stream.addTrack(track);
    });

    return combined.stream;
}

export default add_audio_noise;
