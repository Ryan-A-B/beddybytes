import React from "react";
import Input from "../../components/Input";
import { useAccountService } from "../../services";

interface Props {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    password: string;
    setPassword: React.Dispatch<React.SetStateAction<string>>;
    switchToLogin: () => void;
}

const CreateAccountForm: React.FunctionComponent<Props> = ({ email, setEmail, password, setPassword, switchToLogin }) => {
    const account_service = useAccountService()
    const [error, setError] = React.useState<string | null>(null)
    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        account_service.create_account(email, password)
            .catch((error) => {
                setError(error.message)
            })
    }, [account_service, email, password])
    return (
        <React.Fragment>
            <form onSubmit={handleSubmit} className="was-validated">
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
                    <div className="form-text">At least 20 characters required.</div>
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
