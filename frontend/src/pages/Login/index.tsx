import React from "react";
import { useAuthorizationService } from "../../services";
import LoginOrCreateAccount from "./LoginOrCreateAccount";
import useServiceState from "../../hooks/useServiceState";

interface Props {
    children: React.ReactNode
}

const Login: React.FunctionComponent<Props> = ({ children }) => {
    const authorization_service = useAuthorizationService();
    const authorization_state = useServiceState(authorization_service);
    if (!authorization_state.access_token_available) {
        return (
            <LoginOrCreateAccount/>
        )
    }
    return (
        <React.Fragment>
            {children}
        </React.Fragment>
    )
}

export default Login
