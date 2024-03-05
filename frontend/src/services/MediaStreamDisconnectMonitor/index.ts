import moment from "moment";

const monitoringInterval = 100; // 100ms
const monitorPatience = 10 * 1000 / monitoringInterval; // 10 seconds

class MediaStreamDisconnectMonitor extends EventTarget {
    readonly stream: MediaStream;
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private source: MediaStreamAudioSourceNode;
    private dataArray: Uint8Array;
    private state: MediaStreamConnectionState;
    private ticker: NodeJS.Timer;

    constructor(stream: MediaStream) {
        super();
        this.stream = stream;
        this.audioContext = new AudioContext();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.source = this.audioContext.createMediaStreamSource(stream);
        this.source.connect(this.analyser);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this.state = {
            state: 'connected',
            start: moment(),
        };

        this.ticker = setInterval(this.tick, monitoringInterval)
    }

    public get_state = () => {
        return this.state;
    }

    private set_state = (state: MediaStreamConnectionState) => {
        this.state = state;
        this.dispatchEvent(new Event('statechange'));
    }

    private tick = () => {
        this.analyser.getByteFrequencyData(this.dataArray);
        const total = this.dataArray.reduce((total, value) => total + value, 0)
        if (total > 0) this.up_tick();
        else this.down_tick();
    }

    private up_tick = () => {
        if (this.state.state === 'connected') return;
        return this.set_state({ state: 'connected', start: moment() });
    }

    private down_tick = () => {
        if (this.state.state === 'disconnected') return;
        if (this.state.state === 'connected')
            return this.set_state({ state: 'unstable', start: moment(), counter: 0 });
        const counter = this.state.counter + 1;
        if (counter >= monitorPatience)
            return this.set_state({ state: 'disconnected', start: moment() });
        return this.set_state({ state: 'unstable', start: this.state.start, counter });
    }

    public stop = () => {
        clearInterval(this.ticker);
    }
}

export default MediaStreamDisconnectMonitor;
