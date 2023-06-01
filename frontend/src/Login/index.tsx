import React from 'react';
import * as AuthorizationServer from "../AuthorizationServer";
import LoginOrCreateAccount from './LoginOrCreateAccount';

interface Props {
    children: React.ReactNode
}

interface LoggedIn {
    state: "logged-in"
    loginFrame: AuthorizationServer.LoginFrame
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
    const authorizationServer = AuthorizationServer.useAuthorizationServer()
    const [loginState, setLoginState] = useLoginState()
    const handleSuccessfulLogin = React.useCallback((loginFrame: AuthorizationServer.LoginFrame) => {
        setLoginState({
            state: "logged-in",
            loginFrame,
        })
    }, [setLoginState])
    React.useEffect(() => {
        if (loginState.state === "logged-in") return
        authorizationServer.refresh()
            .then((loginFrame) => handleSuccessfulLogin(loginFrame))
            .catch(() => { console.log("failed to refresh") })
    }, [authorizationServer, loginState, handleSuccessfulLogin])
    if (loginState.state === "logged-out") {
        return <LoginOrCreateAccount onSuccessfulLogin={handleSuccessfulLogin} />
    }
    return (
        <React.Fragment>
            {children}
        </React.Fragment>
    )
}

export default Login
