import React from "react";
import Input from "../../components/Input";
import { Severity } from "../../services/LoggingService";
import { useAuthorizationService, useLoggingService } from "../../services";

interface Props {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    password: string;
    setPassword: React.Dispatch<React.SetStateAction<string>>;
    switchToCreateAccount: () => void;
}

const LoginForm: React.FunctionComponent<Props> = ({ email, setEmail, password, setPassword, switchToCreateAccount }) => {
    const authorization_service = useAuthorizationService();
    const logging_service = useLoggingService();
    const [error, setError] = React.useState<string | null>(null)
    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        authorization_service.login(email, password)
            .catch((error) => {
                logging_service.log({
                    severity: Severity.Error,
                    message: error.message,
                })
                setError(error.message)
            })
    }, [logging_service, authorization_service, email, password])
    return (
        <React.Fragment>
            <form id="form-login" onSubmit={handleSubmit}>
                <div className="form-group mb-3">
                    <label>
                        Email:
                    </label>
                    <Input
                        id="input-login-email"
                        type="email"
                        name="email"
                        value={email}
                        onChange={setEmail}
                        autoComplete="email"
                        className="form-control"
                        autoFocus
                        required
                    />
                </div>
                <div className="form-group mb-3">
                    <label>
                        Password:
                    </label>
                    <Input
                        id="input-login-password"
                        type="password"
                        name="password"
                        value={password}
                        onChange={setPassword}
                        autoComplete="current-password"
                        className="form-control"
                        required
                    />
                </div>
                <p>
                    Don't have an account? <button type="button" className="btn btn-link p-0" onClick={switchToCreateAccount}>Create one</button>.
                </p>
                {error && <div className="alert alert-danger">{error}</div>}
                <button id="submit-button-login" type="submit" className="btn btn-primary w-100">
                    Log In
                </button>
            </form>
        </React.Fragment>
    )
}

export default LoginForm
