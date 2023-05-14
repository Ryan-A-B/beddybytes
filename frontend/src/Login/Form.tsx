import React from "react";
import Input from "./Input";
import * as AuthorizationServer from "../AuthorizationServer";

interface Props {
    onSuccessfulLogin: (frame: AuthorizationServer.LoginFrame) => void
}

const Form: React.FunctionComponent<Props> = ({ onSuccessfulLogin }) => {
    const authorizationServer = AuthorizationServer.useAuthorizationServer()
    const [username, setUsername] = React.useState<string>("")
    const [password, setPassword] = React.useState<string>("")
    const [error, setError] = React.useState<string | null>(null)
    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        authorizationServer.login(username, password)
            .then(onSuccessfulLogin)
            .catch((error) => {
                setError(error.message)
            })
    }, [authorizationServer, username, password, onSuccessfulLogin])
    return (
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>
                        Username:
                        <Input
                            type="text"
                            name="username"
                            value={username}
                            onChange={setUsername}
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
                <button type="submit" className="btn btn-primary">
                    Login
                </button>
            </form>
    )
}

export default Form