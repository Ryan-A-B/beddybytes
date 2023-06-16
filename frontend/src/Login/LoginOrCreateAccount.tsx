import React from "react";
import * as AuthorizationServer from "../AuthorizationServer";
import LoginForm from "./LoginForm";
import CreateAccountForm from "./CreateAccountForm";

interface Props {
    onSuccessfulLogin: (frame: AuthorizationServer.LoginFrame) => void
}

const TabLogin = "login"
const TabCreateAccount = "create_account"

const useOnTabClick = (tab: string, setTab: React.Dispatch<React.SetStateAction<string>>) => {
    return React.useCallback(() => {
        setTab(tab)
    }, [tab, setTab])
}

const getNavLinkClassName = (tab: string, activeTab: string) => {
    if (tab === activeTab) return "nav-link active"
    return "nav-link"
}

const LoginOrCreateAccount: React.FunctionComponent<Props> = ({ onSuccessfulLogin }) => {
    const [tab, setTab] = React.useState(TabLogin)
    const onLoginTabClick = useOnTabClick(TabLogin, setTab)
    const onCreateAccountTabClick = useOnTabClick(TabCreateAccount, setTab)
    return (
        <div className="row">
            <div className="col-xl-4 col-md-6 mx-auto mt-5">
                <div className="card">
                    <div className="card-header">
                        <ul className="nav nav-tabs card-header-tabs nav-fill">
                            <li className="nav-item">
                                <button className={getNavLinkClassName(TabLogin, tab)} onClick={onLoginTabClick}>
                                    Log In
                                </button>
                            </li>
                            <li className="nav-item">
                                <button className={getNavLinkClassName(TabCreateAccount, tab)} onClick={onCreateAccountTabClick}>
                                    Create Account
                                </button>
                            </li>
                        </ul>
                    </div>
                    <div className="card-body">
                        {tab === TabLogin && <LoginForm onSuccessfulLogin={onSuccessfulLogin} />}
                        {tab === TabCreateAccount && <CreateAccountForm onSuccessfulLogin={onSuccessfulLogin} />}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoginOrCreateAccount
