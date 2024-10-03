const get_audio_noise_track = (): MediaStreamTrack => {
    const audio_context = new AudioContext();

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

    const destination = audio_context.createMediaStreamDestination();
    noise.connect(destination);
    return destination.stream.getAudioTracks()[0];
}

export default get_audio_noise_track;