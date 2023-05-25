import React from 'react';
import { v4 as uuid } from 'uuid';
import * as DeviceRegistrar from '../DeviceRegistrar';
import Select from '../FormComponents/Select';
import Input from '../FormComponents/Input';

interface Props {
    onSuccessfulRegistration: (frame: DeviceRegistrar.Device) => void
}

const Form: React.FunctionComponent<Props> = ({ onSuccessfulRegistration }) => {
    const clientID = React.useMemo(() => uuid(), [])
    const [deviceType, setDeviceType] = React.useState<string>("")
    const [deviceAlias, setDeviceAlias] = React.useState<string>("")
    const [error, setError] = React.useState<string | null>(null)
    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (deviceType === "") {
            setError("Please select a device type")
            return
        }
        const device: DeviceRegistrar.Device = {
            id: clientID,
            type: deviceType,
            alias: deviceAlias,
        }
        onSuccessfulRegistration(device)
    }, [onSuccessfulRegistration, clientID, deviceType, deviceAlias])
    return (
        <form onSubmit={handleSubmit}>
            <div>
                Client ID: {clientID}
            </div>
            <div className="form-group">
                <label>
                    Device alias:
                </label>
                <Input value={deviceAlias} onChange={setDeviceAlias} placeholder="Camera One" className="form-control" />
            </div>
            <div className="form-group">
                <label>
                    Device type:
                </label>
                <Select value={deviceType} onChange={setDeviceType} className="form-control">
                    <option value="">Select device type</option>
                    <option value="camera">Camera</option>
                    <option value="monitor">Monitor</option>
                </Select>
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            <button type="submit" className="btn btn-primary">
                Register
            </button>
        </form>
    )
}

export default Form
