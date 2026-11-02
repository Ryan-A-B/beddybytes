import AuthorizationService from './AuthorizationService';
import disconnect_on_monitor_scope_loss from './disconnect_on_monitor_scope_loss';

test('disconnects once per loss of monitor scope and detaches on cleanup', () => {
    let monitor = false;
    const authorization = new EventTarget() as AuthorizationService;
    authorization.get_claims = () => ({ has_scope: () => monitor });
    const mqtt_service = { disconnect: jest.fn() };
    const stop = disconnect_on_monitor_scope_loss(authorization, mqtt_service);
    const update = (value: boolean) => {
        monitor = value;
        authorization.dispatchEvent(new Event('state_changed'));
    };
    update(false);
    update(true);
    expect(mqtt_service.disconnect).not.toHaveBeenCalled();
    update(false);
    update(false);
    expect(mqtt_service.disconnect).toHaveBeenCalledTimes(1);
    expect(mqtt_service.disconnect).toHaveBeenCalledWith({ reason: 'trial_expired' });
    stop();
    update(true);
    update(false);
    expect(mqtt_service.disconnect).toHaveBeenCalledTimes(1);
});
