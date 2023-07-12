import React from 'react';
import authorization, { AuthorizationEventTypeStateChange } from '../authorization';
import LoginOrCreateAccount from './LoginOrCreateAccount';

interface Props {
    children: React.ReactNode
}

const Login: React.FunctionComponent<Props> = ({ children }) => {
    const [authorizationState, setAuthorizationState] = React.useState(() => authorization.getState())
    React.useEffect(() => {
        setAuthorizationState(authorization.getState())
        const onStateChange = () => {
            setAuthorizationState(authorization.getState())
        }
        authorization.addEventListener(AuthorizationEventTypeStateChange, onStateChange)
        return () => {
            authorization.removeEventListener(AuthorizationEventTypeStateChange, onStateChange)
        }
    }, [])
    if (authorizationState === "failed") {
        return <LoginOrCreateAccount onSuccessfulLogin={authorization.setAccessTokenOutput} />
    }
    return (
        <React.Fragment>
            {children}
        </React.Fragment>
    )
}

export default Login
