import React from "react";
import Connection from "./Connection";
import ConnectionSingleton from "./ConnectionSingleton";
import NullConnection from "./NullConnection";

const InitialConnection = new NullConnection();

const useConnection = () => {
    const [connection, setConnection] = React.useState<Connection>(InitialConnection);
    React.useEffect(() => {
        ConnectionSingleton.getInstance().then(setConnection);
    }, []);
    return connection;
}

export default useConnection;