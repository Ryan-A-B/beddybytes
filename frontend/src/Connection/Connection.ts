

export interface Signal {
    to_connection_id: string;
    data: any;
}

export interface Signaler extends EventTarget {
    sendSignal: (signal: Signal) => void;
}

interface Connection extends Signaler, EventTarget {
    readonly id: string;
}

export default Connection;
