import React from "react";
import Input from "../FormComponents/Input";
import * as AuthorizationServer from "../AuthorizationServer";

interface Props {
    onSuccessfulLogin: (frame: AuthorizationServer.LoginFrame) => void
}

const CreateAccountForm: React.FunctionComponent<Props> = ({ onSuccessfulLogin }) => {
    const authorizationServer = AuthorizationServer.useAuthorizationServer()
    const [email, setEmail] = React.useState<string>("")
    const [password, setPassword] = React.useState<string>("")
    const [error, setError] = React.useState<string | null>(null)
    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        authorizationServer.createAccount(email, password)
            .then(() => authorizationServer.login(email, password))
            .then(onSuccessfulLogin)
            .catch((error) => {
                setError(error.message)
            })
    }, [authorizationServer, email, password, onSuccessfulLogin])
    return (
        <React.Fragment>
            <h1>Create Account</h1>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>
                        Email:
                        <Input
                            type="text"
                            name="email"
                            value={email}
                            onChange={setEmail}
                            className="form-control"
                        />
                    </label>
                </div>
                <div className="form-group">
                    <label>
                        Password:
                        <Input
                            type="password"
                            name="password"
                            value={password}
                            onChange={setPassword}
                            className="form-control"
                        />
                    </label>
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <button type="submit" className="btn btn-primary mt-3">
                    Create Account
                </button>
            </form>
        </React.Fragment>
    )
}

export default CreateAccountForm
