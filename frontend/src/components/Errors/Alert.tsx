import React from 'react';
import { List } from 'immutable';

import ErrorService, { ErrorFrame } from '../../services/ErrorService';
import ErrorList from './ErrorList';
import Tips from './Tips';
import useServiceState from '../../hooks/useServiceState';

interface Props {
    error_service: ErrorService
}

const ErrorSectionClassName = `collapse`;
const ShowErrorSectionClassName = `${ErrorSectionClassName} show mt-3`;

const TipsSectionClassName = `collapse`;
const ShowTipsSectionClassName = `${TipsSectionClassName} show mt-3`;

type ShowValue = 'errors' | 'tips' | 'none';

const get_email_body = (user_agent: string, errors: List<ErrorFrame>) => `Hi Ryan,

I've encountered an issue while using BeddyBytes. Here are the details:

[Any additional context you'd like to provide]

User Agent: ${user_agent}

Errors:
${errors.map((error_frame) => `- ${error_frame.error.message}`).join('\n')}

Thanks,
[Your Name]
[Your Email]
`.trim();

const Alert: React.FunctionComponent<Props> = ({ error_service }) => {
    const errors = useServiceState(error_service);
    const [show, setShow] = React.useState<ShowValue>('none');

    const handleShowErrors = React.useCallback(() => {
        if (show === 'errors') setShow('none');
        else setShow('errors');
    }, [show]);

    const handleShowTips = React.useCallback(() => {
        if (show === 'tips') setShow('none');
        else setShow('tips');
    }, [show]);

    const mail_to = React.useMemo(() => {
        const user_agent = navigator.userAgent;
        const parameters = new URLSearchParams({
            subject: "BeddyBytes Errors",
            body: get_email_body(user_agent, errors)
        })
        return "mailto:ryan@beddybytes.com?" + parameters.toString();
    }, [errors])

    return (
        <div className="container mt-3">
            <div className="alert alert-danger" role="alert">
                <div className="d-flex align-items-center justify-content-between">
                    <h5>Hi there!</h5>
                    <button
                        type="button"
                        onClick={error_service.clear_errors}
                        className="btn-close"
                    />
                </div>
                <p>
                    It seems you've encountered an error I haven't yet handled automatically.
                    Below, you'll find some error details - there's a slim chance they might help you
                    resolve the issue. More likely, though, they'll be cryptic and not particularly
                    helpful. If that's the 
                    case, <a href={mail_to} target="_blank" rel="noreferrer">please reach out to me</a>,
                    and I'll make sure to get it sorted. In the meantime check out the general tips below.
                </p>
                <div className="row justify-content-center">
                    <div className="col-auto">
                        <button
                            type="button"
                            className="btn btn-info"
                            onClick={handleShowErrors}
                        >
                            {show === 'errors' ? 'Hide' : 'Show'} Errors
                        </button>
                    </div>
                    <div className="col-auto">
                        <button
                            type="button"
                            className="btn btn-info"
                            onClick={handleShowTips}
                        >
                            {show === 'tips' ? 'Hide' : 'Show'} Tips
                        </button>
                    </div>
                </div>
                <section className={show === 'errors' ? ShowErrorSectionClassName : ErrorSectionClassName}>
                    <ErrorList error_service={error_service} />
                </section>
                <section className={show === 'tips' ? ShowTipsSectionClassName : TipsSectionClassName}>
                    <Tips />
                </section>
            </div>
        </div>
    );
}

export default Alert;