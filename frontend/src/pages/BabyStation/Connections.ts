import { Map } from "immutable";
import MQTTService, { MessageReceived, Subscription } from "../../services/MQTTService";
import { WebRTCInboxPayload } from "../../services/MQTTService/payloads";
import Connection from "../../services/Connection";
import LoggingService from "../../services/LoggingService";

interface NewConnectionsInput {
    logging_service: LoggingService;
    mqtt_service: MQTTService;
    audio_tracks: MediaStreamTrack[];
    video_tracks: MediaStreamTrack[];
}

class Connections {
    private readonly logging_service: LoggingService;
    private readonly mqtt_service: MQTTService;
    private readonly audio_tracks: MediaStreamTrack[];
    private readonly video_tracks: MediaStreamTrack[];
    private readonly subscription: Subscription;
    private connections: Map<string, Connection> = Map();

    constructor(input: NewConnectionsInput) {
        this.logging_service = input.logging_service;
        this.mqtt_service = input.mqtt_service;
        this.audio_tracks = input.audio_tracks;
        this.video_tracks = input.video_tracks;
        this.subscription = this.mqtt_service.subscribe_to_webrtc_inbox(this.handle_webrtc_message);
    }

    private handle_webrtc_message = async (message: MessageReceived): Promise<void> => {
        const payload = JSON.parse(message.payload) as WebRTCInboxPayload;
        if (payload.type !== "description") return;
        if (payload.description.type !== "offer") return;
        if (this.connections.has(payload.from_client_id)) return;
        await this.handle_offer(payload.from_client_id, payload.description);
    }

    private handle_offer = async (peer_client_id: string, offer: RTCSessionDescriptionInit): Promise<void> => {
        const connection = Connection.accept_offer({
            logging_service: this.logging_service,
            mqtt_service: this.mqtt_service,
            peer_client_id,
            offer,
        });
        this.connections = this.connections.set(peer_client_id, connection);
        this.audio_tracks.forEach((track) => connection.peer_connection.addTrack(track));
        this.video_tracks.forEach((track) => connection.peer_connection.addTrack(track));
    }

    close = () => {
        this.connections.forEach((connection) => {
            connection.close()
        });
        this.subscription.close();
    }
}

export default Connections;
