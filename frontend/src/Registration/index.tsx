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

const localStorageKey = "registration_state"

const loadRegistrationState = (): RegistrationState| null => {
    const value = localStorage.getItem(localStorageKey)
    if (value === null) return null
    return JSON.parse(value)
}

const saveRegistrationState = (registrationState: RegistrationState): void => {
    localStorage.setItem(localStorageKey, JSON.stringify(registrationState))
}

const useRegistrationState = (): [RegistrationState, (state: RegistrationState) => void] => {
    const [registrationState, setRegistrationState] = React.useState<RegistrationState>(() => {
        const state = loadRegistrationState()
        if (state === null) return InitialRegistrationState
        return state
    })
    const setRegistrationStateAndSave = React.useCallback((state: RegistrationState) => {
        setRegistrationState(state)
        saveRegistrationState(state)
    }, [setRegistrationState])
    return [registrationState, setRegistrationStateAndSave]
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
