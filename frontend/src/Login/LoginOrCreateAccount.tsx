import React from "react";
import * as AuthorizationServer from "../AuthorizationServer";
import { Tab, TabCreateAccount, TabLogin } from "./tab"
import CreateAccountForm from "./CreateAccountForm";
import LoginForm from "./LoginForm";

interface Props {
    onSuccessfulLogin: (frame: AuthorizationServer.LoginFrame) => void
}

const useOnTabClick = (tab: Tab, setTab: React.Dispatch<React.SetStateAction<Tab>>) => {
    return React.useCallback(() => {
        setTab(tab)
    }, [tab, setTab])
}

const getNavLinkClassName = (tab: string, activeTab: string) => {
    if (tab === activeTab) return "nav-link active"
    return "nav-link"
}

const LoginOrCreateAccount: React.FunctionComponent<Props> = ({ onSuccessfulLogin }) => {
    const authorizationServer = AuthorizationServer.useAuthorizationServer();
    const [email, setEmail] = React.useState<string>("");
    const [password, setPassword] = React.useState<string>("");
    const [tab, setTab] = React.useState<Tab>(TabCreateAccount);

    const switchToLogin = useOnTabClick(TabLogin, setTab);
    const switchToCreateAccount = useOnTabClick(TabCreateAccount, setTab);

    return (
        <div className="row">
            <div className="col-xl-4 col-md-6 mx-auto mt-5">
                <div className="card">
                    <div className="card-header">
                        <ul className="nav nav-tabs card-header-tabs nav-fill">
                            <li className="nav-item">
                                <button className={getNavLinkClassName(TabLogin, tab)} onClick={switchToLogin}>
                                    Log In
                                </button>
                            </li>
                            <li className="nav-item">
                                <button className={getNavLinkClassName(TabCreateAccount, tab)} onClick={switchToCreateAccount}>
                                    Create Account
                                </button>
                            </li>
                        </ul>
                    </div>
                    <div className="card-body">
                        {tab === TabLogin && (
                            <LoginForm
                                email={email}
                                setEmail={setEmail}
                                password={password}
                                setPassword={setPassword}
                                authorizationServer={authorizationServer}
                                switchToCreateAccount={switchToCreateAccount}
                                onSuccessfulLogin={onSuccessfulLogin}
                            />
                        )}
                        {tab === TabCreateAccount && (
                            <CreateAccountForm
                                email={email}
                                setEmail={setEmail}
                                password={password}
                                setPassword={setPassword}
                                authorizationServer={authorizationServer}
                                switchToLogin={switchToLogin}
                                onSuccessfulLogin={onSuccessfulLogin}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginOrCreateAccount
