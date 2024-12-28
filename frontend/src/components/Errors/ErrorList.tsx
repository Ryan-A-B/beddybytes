import React from "react"

import ErrorService from "../../services/ErrorService"
import useServiceState from "../../hooks/useServiceState"

interface Props {
    error_service: ErrorService
}

const ErrorList: React.FunctionComponent<Props> = ({ error_service }) => {
    const errors = useServiceState(error_service)
    return (
        <ul>
            {errors.map((error_frame) => (
                <li key={error_frame.id}>
                    {error_frame.error.message}
                    <button
                        type="button"
                        className="btn-close"
                        onClick={() => error_service.dismiss_error(error_frame.id)}
                    />
                </li>
            ))}
        </ul>
    )
}

export default ErrorList;