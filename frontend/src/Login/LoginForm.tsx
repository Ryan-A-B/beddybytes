import React from "react";
import Input from "../FormComponents/Input";
import * as AuthorizationServer from "../AuthorizationServer";

interface Props {
    onSuccessfulLogin: (frame: AuthorizationServer.LoginFrame) => void
}

const LoginForm: React.FunctionComponent<Props> = ({ onSuccessfulLogin }) => {
    const authorizationServer = AuthorizationServer.useAuthorizationServer()
    const [email, setEmail] = React.useState<string>("")
    const [password, setPassword] = React.useState<string>("")
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
            <h1>Login</h1>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>
                        Email:
                        <Input
                            type="email"
                            name="email"
                            value={email}
                            onChange={setEmail}
                            className="form-control"
                            required
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
                            required
                        />
                    </label>
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <button type="submit" className="btn btn-primary mt-3">
                    Login
                </button>
            </form>
        </React.Fragment>
    )
}

export default LoginForm