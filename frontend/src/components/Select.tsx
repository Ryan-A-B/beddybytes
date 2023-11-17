import React from 'react'

interface Props extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
    value: string
    onChange: (value: string) => void
}

const Select: React.FunctionComponent<Props> = ({ onChange, ...props }) => {
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(event.target.value)
    }, [onChange])
    return (
        <select onChange={handleChange} {...props} />
    )
}

export default Select
