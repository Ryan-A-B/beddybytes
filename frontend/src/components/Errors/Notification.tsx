import React from 'react';

interface Props {
    troubleshoot: () => void
    close: () => void
}

const Notification: React.FunctionComponent<Props> = ({ troubleshoot, close }) => {
    return (
        <div className="initial-error-check bg-primary text-bg-primary px-3">
            Looks like something isn't working?
            <button
                type="button"
                onClick={troubleshoot}
                className="btn btn-link text-bg-primary"
            >
                Troubleshoot
            </button>
            <button
                type="button"
                onClick={close}
                className="btn-close text-bg-primary"
            />
        </div>
    )
}

export default Notification;