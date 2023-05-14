import React from 'react';
import LoginForm from './Form';
import * as Authenticator from "../AuthorizationServer";

interface Props {
    children: React.ReactNode
}

interface LoggedIn {
    state: "logged-in"
    loginFrame: Authenticator.LoginFrame
}

interface LoggedOut {
    state: "logged-out"
}

type LoginState = LoggedIn | LoggedOut

const InitialLoginState: LoginState = {
    state: "logged-out",
}

const useLoginState = (): [LoginState, (state: LoginState) => void] => {
    const [loginState, setLoginState] = React.useState<LoginState>(InitialLoginState)
    return [loginState, setLoginState]
}

const Login: React.FunctionComponent<Props> = ({ children }) => {
    const [loginState, setLoginState] = useLoginState()
    const handleSuccessfulLogin = React.useCallback((loginFrame: Authenticator.LoginFrame) => {
        setLoginState({
            state: "logged-in",
            loginFrame,
        })
    }, [setLoginState])

    if (loginState.state === "logged-out") {
        return <LoginForm onSuccessfulLogin={handleSuccessfulLogin} />
    }

    return (
        <React.Fragment>
            {children}
        </React.Fragment>
    )
}

export default Login
