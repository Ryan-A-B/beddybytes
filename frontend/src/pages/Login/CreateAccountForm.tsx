import React from "react";
import Input from "../../components/Input";
import { useAuthorizationService } from "../../services";

interface Props {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    password: string;
    setPassword: React.Dispatch<React.SetStateAction<string>>;
    switchToLogin: () => void;
}

const CreateAccountForm: React.FunctionComponent<Props> = ({ email, setEmail, password, setPassword, switchToLogin }) => {
    const authorization_service = useAuthorizationService();
    const [error, setError] = React.useState<string | null>(null)
    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        authorization_service.create_account_and_login(email, password)
            .catch((error) => {
                setError(error.message)
            })
    }, [authorization_service, email, password])
    return (
        <form id='form-create-account' onSubmit={handleSubmit} className="was-validated">
            <div className="form-group mb-3">
                <label>
                    Email:
                </label>
                <Input
                    id="input-create-account-email"
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
                    id="input-create-account-password"
                    type="password"
                    name="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    className="form-control"
                    minLength={20}
                    required
                />
                <div className="form-text">At least 20 characters required.</div>
            </div>
            <p>
                Already have an account? <button type="button" className="btn btn-link p-0" onClick={switchToLogin}>Log in</button>.
            </p>
            {error && <div className="alert alert-danger">{error}</div>}
            <button id="submit-button-create-account" type="submit" className="btn btn-primary w-100">
                Create Account
            </button>
        </form>
    )
}

export default CreateAccountForm
