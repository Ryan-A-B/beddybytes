import React from "react";
import * as AuthorizationServer from "../AuthorizationServer";
import Input from "../FormComponents/Input";

const createAccountAndOrLogin = async (authorizationServer: AuthorizationServer.AuthorizationServer, email: string, password: string): Promise<AuthorizationServer.LoginFrame> => {
    try {
        await authorizationServer.createAccount(email, password);
        return authorizationServer.login(email, password);
    } catch (v) {
        const error = v as AuthorizationServer.ErrorFrame;
        if (error.code !== "email_already_in_use")
            throw new Error(error.message);
        try {
            return await authorizationServer.login(email, password);
        } catch (v) {
            const error = v as Error;
            throw new Error(`An account with that email already exists, so attempted to log in. ${error.message}`);
        }
    }
}

interface Props {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    password: string;
    setPassword: React.Dispatch<React.SetStateAction<string>>;
    authorizationServer: AuthorizationServer.AuthorizationServer;
    switchToLogin: () => void;
    onSuccessfulLogin: (frame: AuthorizationServer.LoginFrame) => void;
}

const CreateAccountForm: React.FunctionComponent<Props> = ({ email, setEmail, password, setPassword, authorizationServer, switchToLogin, onSuccessfulLogin }) => {
    const [error, setError] = React.useState<string | null>(null)
    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        createAccountAndOrLogin(authorizationServer, email, password)
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
                        minLength={20}
                        required
                    />
                </div>
                <p>
                    Already have an account? <button type="button" className="btn btn-link p-0" onClick={switchToLogin}>Log in</button>.
                </p>
                {error && <div className="alert alert-danger">{error}</div>}
                <button type="submit" className="btn btn-primary w-100">
                    Create Account
                </button>
            </form>
        </React.Fragment>
    )
}

export default CreateAccountForm
