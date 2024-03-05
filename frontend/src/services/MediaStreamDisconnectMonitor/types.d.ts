interface MediaStreamConnectedState {
    state: 'connected';
    start: moment.Moment;
}

interface MediaStreamUnstableState {
    state: 'unstable';
    start: moment.Moment;
    counter: number;
}

interface MediaStreamDisconnectedState {
    state: 'disconnected';
    start: moment.Moment;
}

type MediaStreamConnectionState = MediaStreamConnectedState | MediaStreamUnstableState | MediaStreamDisconnectedState;