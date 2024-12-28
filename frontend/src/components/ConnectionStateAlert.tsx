import React from "react"
import Connection, { ConnectionState } from "../services/ParentStation/SessionService/Connection";
import parent_station from "../services/instances/parent_station";
import useServiceState from "../hooks/useServiceState";

const SessionStateRouter: React.FunctionComponent = () => {
    const session_state = useServiceState(parent_station.session_service);
    if (session_state.state !== 'joined') return null;
    return (
        <ConnectionStateAlert connection={session_state.connection} />
    )
}

interface Props {
    connection: Connection;
}

const ConnectionStateAlert: React.FunctionComponent<Props> = ({ connection }) => {
    const connection_state = useServiceState(connection);
    if (connection_state.state === 'new') return null;
    if (connection_state.state === 'connecting') return (
        <div className="alert alert-info mt-3" role="alert">
            Attempting to connect...
        </div>
    )
    if (connection_state.state === 'connected') return null;
    if (connection_state.state === 'disconnected') return (
        <div className="alert alert-warning mt-3" role="alert">
            Connection lost, attempting to reconnect...
        </div>
    )
    if (connection_state.state === 'failed') return (
        <div className="alert alert-danger mt-3" role="alert">
            <div className="row align-items-center">
                <div className="col">
                    Connection failed.
                </div>
                <div className="col-auto">
                    <button className="btn btn-primary btn-sm w-100" onClick={connection.reconnect}>
                        Reconnect
                    </button>
                </div>
            </div>
        </div>
    )
    if (connection_state.state === 'closed') return (
        <div className="alert alert-warning mt-3" role="alert">
            Connection closed.
        </div>
    )
    if (connection_state.state === 'unable_to_connect') return (
        <div className="alert alert-danger mt-3" role="alert">
            <div className="row align-items-center">
                <div className="col-md">
                    <h4>Unable to Connect</h4>
                    <p>
                        The Parent Station is unable to connect to the Baby
                        Station, likely due to network settings.
                    </p>
                    <h5>Things to Check</h5>
                    <section>
                        <h6>Different Networks</h6>
                        <p>
                            Both the Parent Station and Baby Station must be on
                            the same network. This issue often occurs when one
                            or both devices are using a cellular network
                            instead of Wi-Fi.
                        </p>
                    </section>
                    <section>
                        <h6>Firewall</h6>
                        <p>
                            A firewall may be blocking the connection.
                            Firewalls on the Baby Station, Parent Station, or
                            any routers in between can restrict the connection.
                            For example, a computer on a public network often
                            blocks incoming connections by default.
                        </p>
                        <p>
                            The default firewall on OSX blocks coonections
                            required by BeddyBytes. If either the Baby or
                            Parent station is a Mac, you may need to adjust
                            the firewall settings.
                        </p>
                    </section>
                    <section>
                        <h6>VPN</h6>
                        <p>
                            A VPN may be active on one or both devices, which
                            can cause them to appear on separate networks.
                        </p>
                    </section>
                </div>
                <div className="col-md-auto">
                    <button className="btn btn-primary btn-sm w-100" onClick={connection.reconnect}>
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    )
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _exhaustive_check: never = connection_state;
    throw new TypeError(`Unexpected connection state: ${(connection_state as ConnectionState).state}`);
}

export default SessionStateRouter;
