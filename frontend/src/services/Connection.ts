import { List } from 'immutable';
import settings from '../settings';
import Service, { SetStateFunction } from "./Service";
import LoggingService, { Severity } from './LoggingService';
import { SignalEvent, SignalService } from './SignalService/WebSocketSignalService';

interface ServiceProxy {
    logging_service: LoggingService;
    signal_service: SignalService;
    other_connection_id: string; // TODO peer_client_id
    peer_connection: RTCPeerConnection;
    get_state: () => ConnectionState;
    set_state: SetStateFunction<ConnectionState>;
}

abstract class AbstractState {
    public abstract name: string;
    public abstract handle_incoming_description(service: ServiceProxy, description: RTCSessionDescriptionInit): void;
    public abstract handle_incoming_candidate(service: ServiceProxy, candidate: RTCIceCandidateInit): void;
    public abstract handle_description_accepted(service: ServiceProxy): void;
}

interface NewAwaitingAnswerInput {
    candidates: List<RTCIceCandidateInit>;
}

class AwaitingOffer extends AbstractState {
    public name = "awaiting_offer";
    private readonly candidates: List<RTCIceCandidateInit>;

    constructor(candidates: List<RTCIceCandidateInit>) {
        super();
        this.candidates = candidates;
    }

    public handle_incoming_description = (service: ServiceProxy, description: RTCSessionDescriptionInit) => {
        if (description.type !== "offer") throw new Error(`Awaiting offer but received description of type ${description.type}`);
        service.set_state(new AcceptingDescription(this.candidates));
        this.accept_offer(service, description).then(() => service.get_state().handle_description_accepted(service));
    }

    private accept_offer = async (service: ServiceProxy, description: RTCSessionDescriptionInit) => {
        await service.peer_connection.setRemoteDescription(description)
        const answer = await service.peer_connection.createAnswer();
        service.signal_service.send_signal({
            to_connection_id: service.other_connection_id,
            data: {
                description: answer,
            },
        });
    }

    public handle_incoming_candidate = (service: ServiceProxy, candidate: RTCIceCandidateInit) => {
        service.set_state(new AwaitingOffer(this.candidates.push(candidate)));
    }

    public handle_description_accepted = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Informational,
            message: "handle_description_accepted called while in AwaitingOffer state",
        });
    }
}

class AwaitingAnswer extends AbstractState {
    public name = "awaiting_answer";
    private readonly candidates: List<RTCIceCandidateInit>;

    constructor(input: NewAwaitingAnswerInput) {
        super();
        this.candidates = input.candidates;
    }

    public handle_incoming_description = (service: ServiceProxy, description: RTCSessionDescriptionInit): void => {
        if (description.type !== "answer") throw new Error(`Awaiting answer but received description of type ${description.type}`);
        service.set_state(new AcceptingDescription(this.candidates));
        service.peer_connection.setRemoteDescription(description).then(() => service.get_state().handle_description_accepted(service));
    }

    public handle_incoming_candidate = (service: ServiceProxy, candidate: RTCIceCandidateInit): void => {
        service.set_state(new AwaitingAnswer({
            candidates: this.candidates.push(candidate),
        }));
    }

    public handle_description_accepted = (service: ServiceProxy): void => {
        service.logging_service.log({
            severity: Severity.Informational,
            message: "handle_description_accepted called while in AwaitingAnswer state",
        });
    }
}

class AcceptingDescription extends AbstractState {
    public name = "accepting_description";
    private readonly candidates: List<RTCIceCandidateInit>;

    constructor(candidates: List<RTCIceCandidateInit>) {
        super();
        this.candidates = candidates;
    }

    public handle_incoming_description = (service: ServiceProxy, description: RTCSessionDescriptionInit): void => {
        // TODO duplicate signals are possible. is the description the same? if so we can ignore it
        service.logging_service.log({
            severity: Severity.Informational,
            message: `handle_incoming_description called while in AcceptingDescription state with description of type ${description.type}`,
        })
    }

    public handle_incoming_candidate = (service: ServiceProxy, candidate: RTCIceCandidateInit): void => {
        service.set_state(new AcceptingDescription(this.candidates.push(candidate)));
    }

    public handle_description_accepted = (service: ServiceProxy): void => {
        service.set_state(new Active());
        this.candidates.forEach((candidate) => service.peer_connection.addIceCandidate(candidate));
    }
}

class Active extends AbstractState {
    public name = "active";

    public handle_incoming_description = (service: ServiceProxy, description: RTCSessionDescriptionInit): void => {
        service.logging_service.log({
            severity: Severity.Informational,
            message: `handle_incoming_description called while in Active state with description of type ${description.type}`,
        });
    }

    public handle_incoming_candidate = (service: ServiceProxy, candidate: RTCIceCandidateInit): void => {
        service.peer_connection.addIceCandidate(candidate);
    }

    public handle_description_accepted = (service: ServiceProxy): void => {
        service.logging_service.log({
            severity: Severity.Informational,
            message: "handle_description_accepted called while in Active state",
        });
    }
}

type ConnectionState = AwaitingOffer | AwaitingAnswer | AcceptingDescription | Active;

interface NewConnectionInput {
    logging_service: LoggingService;
    signal_service: SignalService;
    other_connection_id: string; // TODO peer_client_id
    peer_connection: RTCPeerConnection;
    initial_state: ConnectionState;
}

interface InitiateInput {
    logging_service: LoggingService;
    signal_service: SignalService;
    other_connection_id: string; // TODO peer_client_id
}

interface AcceptInput {
    logging_service: LoggingService;
    signal_service: SignalService;
    other_connection_id: string; // TODO peer_client_id
    offer: RTCSessionDescriptionInit;
}

class Connection extends Service<ConnectionState> {
    protected readonly name = "Connection";
    private readonly signal_service: SignalService;
    private readonly other_connection_id: string;
    public readonly peer_connection: RTCPeerConnection;
    private readonly proxy: ServiceProxy;

    private constructor(input: NewConnectionInput) {
        super({
            logging_service: input.logging_service,
            initial_state: input.initial_state,
        });
        this.signal_service = input.signal_service;
        this.other_connection_id = input.other_connection_id;
        this.peer_connection = input.peer_connection;
        this.proxy = {
            logging_service: this.logging_service,
            signal_service: this.signal_service,
            other_connection_id: this.other_connection_id,
            peer_connection: input.peer_connection,
            get_state: this.get_state,
            set_state: this.set_state,
        };
        this.signal_service.addEventListener("signal", this.handle_signal);
        input.peer_connection.addEventListener("icecandidate", this.handle_icecandidate);
    }

    protected to_string = (state: ConnectionState): string => {
        return state.name;
    }

    private handle_signal = (event: SignalEvent): void => {
        if (event.signal.from_connection_id !== this.other_connection_id) return;
        const state = this.get_state();
        if (event.signal.data.description !== undefined)
            state.handle_incoming_description(this.proxy, event.signal.data.description);
        if (event.signal.data.candidate !== undefined)
            state.handle_incoming_candidate(this.proxy, event.signal.data.candidate);
    }

    private handle_icecandidate = (event: RTCPeerConnectionIceEvent): void => {
        // TODO null indicates end of candidates. Should we do anything with that?
        if (event.candidate === null) return;
        this.signal_service.send_signal({
            to_connection_id: this.other_connection_id,
            data: { candidate: event.candidate },
        });
    }

    public close = (): void => {
        this.signal_service.removeEventListener("signal", this.handle_signal);
        this.peer_connection.removeEventListener("icecandidate", this.handle_icecandidate);
        this.peer_connection.close();
    }

    static initiate = (input: InitiateInput): Connection => {
        const peer_connection = new RTCPeerConnection(settings.RTC);
        // These transceivers are specifically for the parent station. 
        // When the baby starts initiating the connection it will use "sendonly" for video and audio.
        peer_connection.addTransceiver("video", { direction: "recvonly" });
        // When talkback is implemented audio will be changed to "sendrecv".
        peer_connection.addTransceiver("audio", { direction: "recvonly" });

        peer_connection.setLocalDescription().then(() => {
            input.signal_service.send_signal({
                to_connection_id: input.other_connection_id,
                data: { description: peer_connection.localDescription },
            });
        });
        return new Connection({
            logging_service: input.logging_service,
            signal_service: input.signal_service,
            other_connection_id: input.other_connection_id,
            peer_connection,
            initial_state: new AwaitingAnswer({
                candidates: List<RTCIceCandidateInit>(),
            }),
        });
    }

    static accept_offer = (input: AcceptInput): Connection => {
        const peer_connection = new RTCPeerConnection(settings.RTC);
        const promise = peer_connection.setRemoteDescription(input.offer)
            .then(() => peer_connection.createAnswer())
            .then(async (answer) => {
                await peer_connection.setLocalDescription(answer);
                input.signal_service.send_signal({
                    to_connection_id: input.other_connection_id,
                    data: { description: answer },
                });
            });

        const connection = new Connection({
            logging_service: input.logging_service,
            signal_service: input.signal_service,
            peer_connection,
            other_connection_id: input.other_connection_id,
            initial_state: new AcceptingDescription(List<RTCIceCandidateInit>()),
        });

        promise.then(() => connection.get_state().handle_description_accepted(connection.proxy));

        return connection;
    }
}

export default Connection;