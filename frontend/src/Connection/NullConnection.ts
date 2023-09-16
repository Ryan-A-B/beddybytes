import Connection, { Signal } from './Connection';

class NullConnection extends EventTarget implements Connection {
    readonly id: string = 'null';

    sendSignal = (input: Signal) => {
        console.log('NullConnection.sendSignal', input);
    }
}

export default NullConnection;
