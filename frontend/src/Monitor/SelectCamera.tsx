import React from "react";
import { Client, listClients } from "../config";

interface useClientListOutput {
    clientList: Client[];
    error: Error | null;
}

const useClientList = (): useClientListOutput => {
    const [clientList, setClientList] = React.useState<Client[]>([]);
    const [error, setError] = React.useState<Error | null>(null);
    React.useEffect(() => {
        listClients()
            .then(setClientList)
            .catch(setError);
    }, []);
    return { clientList, error };
};

interface Props extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
    value: string;
    onChange: (value: string) => void;
}

const SelectCamera: React.FunctionComponent<Props> = ({ value, onChange }) => {
    const { clientList, error } = useClientList();
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(event.target.value);
    }, [onChange]);
    if (error !== null) return (
        <div>
            Error: {error.message}
        </div>
    );
    // TODO filter to only cameras
    // TODO display alias
    return (
        <select value={value} onChange={handleChange} className="form-select">
            <option value="">Select a camera</option>
            {clientList.map((client) => (
                <option key={client.id} value={client.id}>
                    {client.id}
                </option>
            ))}
        </select>
    );
};

export default SelectCamera;
