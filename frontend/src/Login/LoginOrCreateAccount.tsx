import React from "react";
import * as AuthorizationServer from "../AuthorizationServer";
import LoginForm from "./LoginForm";
import CreateAccountForm from "./CreateAccountForm";

interface Props {
    onSuccessfulLogin: (frame: AuthorizationServer.LoginFrame) => void
}

const LoginOrCreateAccount: React.FunctionComponent<Props> = ({ onSuccessfulLogin }) => {
    return (
        <div className="row">
            <div className="col-md">
                <LoginForm onSuccessfulLogin={onSuccessfulLogin} />
            </div>
            <div className="col-md">
                <CreateAccountForm onSuccessfulLogin={onSuccessfulLogin} />
            </div>
        </div>
    )
}

export default LoginOrCreateAccount
