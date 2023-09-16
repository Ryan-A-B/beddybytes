import Connection from "./Connection";
import WebSocketConnection from "./WebSocketConnection";

class ConnectionSingleton {
    private static promise: Promise<Connection>;

    static getInstance(): Promise<Connection> {
        if (!ConnectionSingleton.promise) {
            ConnectionSingleton.promise = WebSocketConnection.create();
        }
        return ConnectionSingleton.promise;
    }
}

export default ConnectionSingleton;