import React from "react";

interface Props extends Omit<Omit<React.HTMLProps<HTMLInputElement>, "value">, "onChange"> {
    type?: "checkbox"
    value: boolean
    onChange: (value: boolean) => void
}

const Checkbox: React.FunctionComponent<Props> = ({ value, onChange, ...props }) => {
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.checked)
    }, [onChange])
    return (
        <input {...props} type="checkbox" checked={value} onChange={handleChange} />
    )
}

export default Checkbox
