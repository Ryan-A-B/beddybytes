import React from "react";
import * as AuthorizationServer from "../AuthorizationServer";
import Input from "../FormComponents/Input";

interface Props {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    password: string;
    setPassword: React.Dispatch<React.SetStateAction<string>>;
    authorizationServer: AuthorizationServer.AuthorizationServer;
    switchToCreateAccount: () => void;
    onSuccessfulLogin: (frame: AuthorizationServer.LoginFrame) => void;
}

const LoginForm: React.FunctionComponent<Props> = ({ email, setEmail, password, setPassword, authorizationServer, switchToCreateAccount, onSuccessfulLogin }) => {
    const [error, setError] = React.useState<string | null>(null)
    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        authorizationServer.login(email, password)
            .then(onSuccessfulLogin)
            .catch((error) => {
                setError(error.message)
            })
    }, [authorizationServer, email, password, onSuccessfulLogin])
    return (
        <React.Fragment>
            <form onSubmit={handleSubmit}>
                <div className="form-group mb-3">
                    <label>
                        Email:
                    </label>
                    <Input
                        type="email"
                        name="email"
                        value={email}
                        onChange={setEmail}
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
                        type="password"
                        name="password"
                        value={password}
                        onChange={setPassword}
                        className="form-control"
                        required
                    />
                </div>
                <p>
                    Don't have an account? <button type="button" className="btn btn-link p-0" onClick={switchToCreateAccount}>Create one</button>.
                </p>
                {error && <div className="alert alert-danger">{error}</div>}
                <button type="submit" className="btn btn-primary w-100">
                    Log In
                </button>
            </form>
        </React.Fragment>
    )
}

export default LoginForm
