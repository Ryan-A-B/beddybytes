import React from 'react';
import RegistrationForm from './Form';
import * as DeviceRegistrar from '../DeviceRegistrar';

interface Props {
    children: React.ReactNode
    
}

interface Unregistered {
    state: "unregistered"
}

interface Registered {
    state: "registered"
    device: DeviceRegistrar.Device
}

type RegistrationState = Unregistered | Registered

const InitialRegistrationState: RegistrationState = {
    state: "unregistered",
}

const useRegistrationState = (): [RegistrationState, (state: RegistrationState) => void] => {
    const [registrationState, setRegistrationState] = React.useState<RegistrationState>(InitialRegistrationState)
    return [registrationState, setRegistrationState]
}

const Registration: React.FunctionComponent<Props> = ({ children }) => {
    const [registrationState, setRegistrationState] = useRegistrationState()
    const handleSuccessfulRegistration = React.useCallback((registrationFrame: DeviceRegistrar.Device) => {
        setRegistrationState({
            state: "registered",
            device: registrationFrame,
        })
    }, [setRegistrationState])

    if (registrationState.state === "unregistered") {
        return <RegistrationForm onSuccessfulRegistration={handleSuccessfulRegistration} />
    }

    return (
        <DeviceRegistrar.DeviceContext.Provider value={registrationState.device}>
            {children}
        </DeviceRegistrar.DeviceContext.Provider>
    )
}

export default Registration
