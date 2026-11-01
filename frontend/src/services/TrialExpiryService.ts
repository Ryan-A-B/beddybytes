import AuthorizationService from './AuthorizationService';
import { load_account_from_local_storage } from './AuthorizationService/AuthorizationClient';
import { EventTypeStateChanged } from './Service';

class TrialExpiryService {
    private readonly authorization_service: AuthorizationService;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private trial_expiry_millis: number | null = null;
    private refreshed_trial_expiry_millis: number | null = null;
    private started = false;

    constructor(authorization_service: AuthorizationService) {
        this.authorization_service = authorization_service;
    }

    public start = (): void => {
        if (this.started) return;
        this.started = true;
        this.authorization_service.addEventListener(EventTypeStateChanged, this.schedule_refresh);
        window.addEventListener('focus', this.refresh_if_expired);
        window.addEventListener('online', this.refresh_if_expired);
        window.addEventListener('visibilitychange', this.handle_visibility_change);
        this.schedule_refresh();
    };

    public stop = (): void => {
        this.started = false;
        this.authorization_service.removeEventListener(EventTypeStateChanged, this.schedule_refresh);
        window.removeEventListener('focus', this.refresh_if_expired);
        window.removeEventListener('online', this.refresh_if_expired);
        window.removeEventListener('visibilitychange', this.handle_visibility_change);
        this.clear_timer();
    };

    private clear_timer = (): void => {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        this.trial_expiry_millis = null;
    };

    private schedule_refresh = (): void => {
        this.clear_timer();
        if (!this.authorization_service.get_claims().has_scope('monitor')) return;
        const account = load_account_from_local_storage();
        if (account?.license?.type !== 'trial') return;
        const expiry_millis = account.license.trial_detail.end_unix_seconds * 1000;
        if (expiry_millis === this.refreshed_trial_expiry_millis) return;
        this.trial_expiry_millis = expiry_millis;
        // The refreshed token determines permission; the deadline only triggers refresh.
        this.timer = setTimeout(this.refresh_if_expired, Math.max(0, expiry_millis - Date.now()));
    };

    private refresh_if_expired = (): void => {
        const expiry_millis = this.trial_expiry_millis;
        if (expiry_millis === null || Date.now() < expiry_millis ||
            expiry_millis === this.refreshed_trial_expiry_millis) return;
        this.refreshed_trial_expiry_millis = expiry_millis;
        this.authorization_service.refresh_token();
    };

    private handle_visibility_change = (): void => {
        if (document.visibilityState === 'visible') this.refresh_if_expired();
    };
}

export default TrialExpiryService;
