import { List, Map } from "immutable";
import LoggingService from "../../LoggingService";
import MQTTService, { MessageReceived, Subscription } from "../../MQTTService";
import { parse_client_status_topic } from "../../MQTTService/topics";
import { SessionAnnouncement } from "../../MQTTService/payloads";
import Service, { ServiceStateChangedEvent, SetStateFunction } from "../../Service";
import { BabyStation } from "../types";

interface ServiceProxy {
    mqtt_service: MQTTService;
    set_state: SetStateFunction<BabyStationListState>;
    handle_baby_stations(message: MessageReceived): void;
    handle_control_inbox(message: MessageReceived): void;
    handle_client_status(message: MessageReceived): void;
}

abstract class AbstractState {
    public abstract readonly name: string;

    public start(proxy: ServiceProxy): void {
        // Default is to ignore duplicate start requests.
    }

    public stop(proxy: ServiceProxy): void {
        // Default is to ignore duplicate stop requests.
    }

    public list_baby_stations(): List<BabyStation> {
        return List();
    }

    public handle_baby_stations(proxy: ServiceProxy, message: MessageReceived): void {
        // Default is to ignore messages while stopped.
    }

    public handle_control_inbox(proxy: ServiceProxy, message: MessageReceived): void {
        // Default is to ignore messages while stopped.
    }

    public handle_client_status(proxy: ServiceProxy, message: MessageReceived): void {
        // Default is to ignore messages while stopped.
    }
}

export class Stopped extends AbstractState {
    public readonly name = "Stopped";

    public start(proxy: ServiceProxy): void {
        proxy.set_state(new Running({
            baby_stations: Map(),
            baby_stations_subscription: proxy.mqtt_service.subscribe_to_baby_stations(proxy.handle_baby_stations),
            control_inbox_subscription: proxy.mqtt_service.subscribe_to_control_inbox(proxy.handle_control_inbox),
            client_status_subscription: proxy.mqtt_service.subscribe_to_client_status(proxy.handle_client_status),
        }));
    }
}

interface NewRunningInput {
    baby_stations: Map<string, BabyStation>;
    baby_stations_subscription: Subscription;
    control_inbox_subscription: Subscription;
    client_status_subscription: Subscription;
}

export class Running extends AbstractState {
    public readonly name = "Running";
    private readonly baby_stations: Map<string, BabyStation>;
    private readonly baby_stations_subscription: Subscription;
    private readonly control_inbox_subscription: Subscription;
    private readonly client_status_subscription: Subscription;

    constructor(input: NewRunningInput) {
        super();
        this.baby_stations = input.baby_stations;
        this.baby_stations_subscription = input.baby_stations_subscription;
        this.control_inbox_subscription = input.control_inbox_subscription;
        this.client_status_subscription = input.client_status_subscription;
    }

    public stop(proxy: ServiceProxy): void {
        this.baby_stations_subscription.close();
        this.control_inbox_subscription.close();
        this.client_status_subscription.close();
        proxy.set_state(new Stopped());
    }

    public list_baby_stations(): List<BabyStation> {
        return this.baby_stations.valueSeq().toList();
    }

    public handle_baby_stations(proxy: ServiceProxy, message: MessageReceived): void {
        const payload = JSON.parse(message.payload) as BabyStationsPayload;
        if (payload.type !== "announcement") return;
        this.add_announcement(proxy, payload.announcement);
    }

    public handle_control_inbox(proxy: ServiceProxy, message: MessageReceived): void {
        const payload = JSON.parse(message.payload) as ControlInboxPayload;
        if (payload.type !== "baby_station_announcement") return;
        this.add_announcement(proxy, payload.baby_station_announcement);
    }

    public handle_client_status(proxy: ServiceProxy, message: MessageReceived): void {
        const topic = parse_client_status_topic(message.topic);
        if (topic === null) return;
        const payload = JSON.parse(message.payload) as ClientStatusPayload;
        if (payload.type !== "disconnected") return;
        const entry = this.baby_stations.findEntry((baby_station) => baby_station.client_id === topic.client_id);
        if (entry === undefined) return;
        const [session_id] = entry;
        this.set_baby_stations(proxy, this.baby_stations.delete(session_id));
    }

    private add_announcement = (proxy: ServiceProxy, announcement: SessionAnnouncement): void => {
        if (this.baby_stations.has(announcement.session_id)) return;
        this.set_baby_stations(proxy, this.baby_stations.set(announcement.session_id, {
            client_id: announcement.client_id,
            session: {
                id: announcement.session_id,
                name: announcement.name,
                started_at: announcement.started_at_millis,
            },
        }));
    }

    private set_baby_stations = (proxy: ServiceProxy, baby_stations: Map<string, BabyStation>): void => {
        proxy.set_state(new Running({
            baby_stations,
            baby_stations_subscription: this.baby_stations_subscription,
            control_inbox_subscription: this.control_inbox_subscription,
            client_status_subscription: this.client_status_subscription,
        }));
    }
}

export type BabyStationListState = Stopped | Running;

interface NewBabyStationListServiceInput {
    logging_service: LoggingService;
    mqtt_service: MQTTService;
}

class BabyStationListService extends Service<BabyStationListState> {
    protected readonly name = "BabyStationListService";
    private readonly proxy: ServiceProxy;

    constructor(input: NewBabyStationListServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new Stopped(),
        });
        this.proxy = {
            mqtt_service: input.mqtt_service,
            set_state: this.set_state,
            handle_baby_stations: this.handle_baby_stations,
            handle_control_inbox: this.handle_control_inbox,
            handle_client_status: this.handle_client_status,
        };
    }

    protected to_string = (state: BabyStationListState): string => {
        return state.name;
    }

    public start = (): void => {
        this.get_state().start(this.proxy);
    }

    public stop = (): void => {
        this.get_state().stop(this.proxy);
    }

    public list_baby_stations = (): List<BabyStation> => {
        return this.get_state().list_baby_stations();
    }

    private handle_baby_stations = (message: MessageReceived): void => {
        this.get_state().handle_baby_stations(this.proxy, message);
    }

    private handle_control_inbox = (message: MessageReceived): void => {
        this.get_state().handle_control_inbox(this.proxy, message);
    }

    private handle_client_status = (message: MessageReceived): void => {
        this.get_state().handle_client_status(this.proxy, message);
    }
}

export default BabyStationListService;

interface BabyStationsPayload {
    type: "announcement";
    announcement: SessionAnnouncement;
}

interface ControlInboxPayload {
    type: "baby_station_announcement";
    baby_station_announcement: SessionAnnouncement;
}

interface ClientStatusPayload {
    type: "connected" | "disconnected";
}

interface BabyStationListService extends Service<BabyStationListState> {
    addEventListener(type: "state_changed", listener: (this: EventSource, ev: ServiceStateChangedEvent<BabyStationListState>) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;

    removeEventListener(type: "state_changed", listener: (this: EventSource, ev: ServiceStateChangedEvent<BabyStationListState>) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}
