import AuthorizationService from './AuthorizationService';
import MQTTService from './MQTTService';
import { EventTypeStateChanged } from './Service';

const disconnect_on_monitor_scope_loss = (authorization_service: AuthorizationService, mqtt_service: Pick<MQTTService, 'disconnect'>): (() => void) => {
    let had_monitor_scope = authorization_service.get_claims().has_scope('monitor');
    const handle_change = (): void => {
        const has_monitor_scope = authorization_service.get_claims().has_scope('monitor');
        if (had_monitor_scope && !has_monitor_scope) mqtt_service.disconnect({ reason: 'authorization_scope_lost' });
        had_monitor_scope = has_monitor_scope;
    };
    authorization_service.addEventListener(EventTypeStateChanged, handle_change);
    return () => authorization_service.removeEventListener(EventTypeStateChanged, handle_change);
};

export default disconnect_on_monitor_scope_loss;
