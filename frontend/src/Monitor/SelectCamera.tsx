import React from "react";
import * as DeviceRegistrar from "../DeviceRegistrar";

interface useClientListOutput {
    loading: boolean;
    clientList: DeviceRegistrar.Device[];
    refresh: () => void;
    error: Error | null;
}

const useClientList = (): useClientListOutput => {
    const deviceRegistrar = DeviceRegistrar.useDeviceRegistrar();
    const [loading, setLoading] = React.useState(true);
    const [clientList, setClientList] = React.useState<DeviceRegistrar.Device[]>([]);
    const [error, setError] = React.useState<Error | null>(null);
    const getClientList = React.useCallback(() => {
        setLoading(true);
        deviceRegistrar.list()
            .then((clients) => {
                setClientList(clients);
                setLoading(false);
            })
            .catch(setError);
    }, [deviceRegistrar]);
    React.useEffect(getClientList, [getClientList]);
    return {
        loading,
        clientList,
        refresh: getClientList,
        error
    };
};

interface Props extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
    value: string;
    onChange: (value: string) => void;
}

const SelectCamera: React.FunctionComponent<Props> = ({ value, onChange }) => {
    const { loading, clientList, refresh: refreshClientList, error } = useClientList();
    const cameras = React.useMemo(() => clientList.filter((client) => client.type === "camera"), [clientList]);
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(event.target.value);
    }, [onChange]);
    if (error !== null) return (
        <div>
            Error: {error.message}
        </div>
    );
    return (
        <div className="row justify-content-center">
            <div className="col-lg-4 col-md-5 col">
                {loading && <div>Loading...</div>}
                {!loading && cameras.length === 0 && <div>No cameras found</div>}
                {!loading && cameras.length > 0 && (
                    <select value={value} onChange={handleChange} className="form-select">
                        <option value="">Select a camera</option>
                        {cameras.map((client) => (
                            <option key={client.id} value={client.id}>
                                {client.alias || client.id}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            <div className="col-auto">
                <button onClick={refreshClientList} className="btn btn-primary">
                    Refresh
                </button>
            </div>
        </div>
    );
};

export default SelectCamera;
