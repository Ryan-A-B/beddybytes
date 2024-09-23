import React from "react";
import { useAuthorizationService } from "../services";
import useServiceState from "./useServiceState";
import { AccountStatus, AuthorizationState } from "../services/AuthorizationService/types";

const authorization_state_to_account_status = (authorization_state: AuthorizationState): AccountStatus => {
    if (authorization_state.state === 'no_account') return { status: 'no_account' };
    return {
        status: 'have_account',
        account: authorization_state.account,
    };
}

const useAccountStatus = (): AccountStatus => {
    const authorization_service = useAuthorizationService();
    const authorization_state = useServiceState(authorization_service);
    return React.useMemo(
        () => authorization_state_to_account_status(authorization_state),
        [authorization_state]
    );
}

export default useAccountStatus;