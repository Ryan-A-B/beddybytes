import React from "react";
import LoginOrCreateAccount from "./LoginOrCreateAccount";
import useAccountStatus from "../../hooks/useAccountStatus";

interface Props {
    children: React.ReactNode
}

const Login: React.FunctionComponent<Props> = ({ children }) => {
    const account_status = useAccountStatus();
    if (account_status.status === 'no_account') return (
        <LoginOrCreateAccount/>
    )
    return (
        <React.Fragment>
            {children}
        </React.Fragment>
    )
}

export default Login
