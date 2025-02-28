import React from 'react';

export interface Props extends Omit<React.HTMLProps<HTMLInputElement>, "onChange"> {
    value: string
    onChange: (value: string) => void
}

const Input: React.FunctionComponent<Props> = ({ onChange, ...props }) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.value)
    }

    return (
        <input {...props} onChange={handleChange} />
    )
}

export default Input
