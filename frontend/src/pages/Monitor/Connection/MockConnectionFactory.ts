import { Connection, ConnectionFactory } from ".";
import { Session } from "../../../Sessions/Sessions";

class MockConnection implements Connection {
    session: Session;
    constructor(session: Session) {
        this.session = session;
    }

    set ontrack(ontrack: (event: RTCTrackEvent) => void) { }

    set onconnectionstatechange(connectionstatechange: (event: Event) => void) { }

    close = (initiatedByPeer: boolean) => {
    };
}

class MockConnectionFactory implements ConnectionFactory {
    connections: MockConnection[] = [];

    create(session: Session): Connection {
        const connection = new MockConnection(session);
        this.connections.push(connection);
        return connection;
    }
}

export default MockConnectionFactory;
