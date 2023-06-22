import React from 'react';
import { v4 as uuid } from 'uuid';
import * as DeviceRegistrar from '../DeviceRegistrar';
import Input from '../FormComponents/Input';

interface Props {
    onSuccessfulRegistration: (frame: DeviceRegistrar.Device) => void
}

const Form: React.FunctionComponent<Props> = ({ onSuccessfulRegistration }) => {
    const clientID = React.useMemo(() => uuid(), [])
    const [deviceAlias, setDeviceAlias] = React.useState<string>("")
    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const device: DeviceRegistrar.Device = {
            id: clientID,
            alias: deviceAlias,
        }
        onSuccessfulRegistration(device)
    }, [onSuccessfulRegistration, clientID, deviceAlias])
    return (
        <form onSubmit={handleSubmit}>
            <div>
                Client ID: {clientID}
            </div>
            <div className="form-group">
                <label>
                    Device alias:
                </label>
                <Input value={deviceAlias} onChange={setDeviceAlias} placeholder="Camera One" className="form-control" required />
            </div>
            <button type="submit" className="btn btn-primary">
                Register
            </button>
        </form>
    )
}

export default Form
