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
    const authorization = React.useMemo(() => {
        if (loginState.state !== "logged-in") return null
        if (loginState.loginFrame.token_type !== "Bearer") return null
        return `Bearer ${loginState.loginFrame.access_token}`
    }, [loginState])
    if (loginState.state === "logged-out") {
        return <LoginOrCreateAccount onSuccessfulLogin={handleSuccessfulLogin} />
    }
    return (
        <AuthorizationServer.AuthorizationContext.Provider value={authorization}>
            <AuthorizationServer.AccessTokenContext.Provider value={loginState.loginFrame.access_token}>
                {children}
            </AuthorizationServer.AccessTokenContext.Provider>
        </AuthorizationServer.AuthorizationContext.Provider>
    )
}

export default Login
