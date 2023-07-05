import React from "react";
import settings from "../settings";
import * as DeviceRegistrar from "../DeviceRegistrar";
import fetchClientList from "./fetchClientList";

interface useClientListOutput {
    loading: boolean;
    clientList: DeviceRegistrar.Device[];
    refresh: () => void;
    error: Error | null;
}

const useClientList = (): useClientListOutput => {
    const [loading, setLoading] = React.useState(true);
    const [clientList, setClientList] = React.useState<DeviceRegistrar.Device[]>([]);
    const [error, setError] = React.useState<Error | null>(null);
    const getClientList = React.useCallback(() => {
        setLoading(true);
        fetchClientList(settings.API.host)
            .then((clients) => {
                setClientList(clients);
                setLoading(false);
            })
            .catch(setError);
    }, []);
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
    refreshKey: string; // TODO this isn't a good way to do this
}

const SelectCamera: React.FunctionComponent<Props> = ({ value, onChange, refreshKey }) => {
    const { loading, clientList, refresh: refreshClientList, error } = useClientList();
    React.useEffect(() => {
        if (refreshKey === "") return;
        refreshClientList();
    }, [refreshClientList, refreshKey]);
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
        <div className="row">
            <div className="col">
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
