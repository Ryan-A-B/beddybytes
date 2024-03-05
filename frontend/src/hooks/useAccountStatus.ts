import React from "react";
import { useAuthorizationService } from "../services";

const authorization_state_to_account_status = (authorization_state: AuthorizationState): AccountStatus => {
    if (authorization_state.state === 'no_account') return { status: 'no_account' };
    return {
        status: 'have_account',
        account: authorization_state.account,
    };
}

const useAccountStatus = (): AccountStatus => {
    const authorization_service = useAuthorizationService();
    const [status, set_status] = React.useState<AccountStatus>(() => {
        const authorization_state = authorization_service.get_state();
        return authorization_state_to_account_status(authorization_state);
    });
    React.useEffect(() => {
        const handle_account_status_changed = () => {
            const authorization_state = authorization_service.get_state();
            set_status(authorization_state_to_account_status(authorization_state));
        }
        authorization_service.addEventListener('statechange', handle_account_status_changed);
        return () => {
            authorization_service.removeEventListener('statechange', handle_account_status_changed);
        }
    }, [authorization_service]);

    return status;
}

export default useAccountStatus;