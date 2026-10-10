import React from "react";
import { Tab, TabCreateAccount, TabLogin } from "./tab"
import CreateAccountForm from "./CreateAccountForm";
import LoginForm from "./LoginForm";

const useOnTabClick = (tab: Tab, setTab: React.Dispatch<React.SetStateAction<Tab>>) => {
    return React.useCallback(() => {
        setTab(tab)
    }, [tab, setTab])
}

const getNavLinkClassName = (tab: string, activeTab: string) => {
    if (tab === activeTab) return "nav-link active"
    return "nav-link"
}

const LoginOrCreateAccountForm: React.FC<{ initialTab?: Tab; onAuthenticated?: () => void }> = ({ initialTab, onAuthenticated }) => {
    const [email, setEmail] = React.useState<string>("");
    const [password, setPassword] = React.useState<string>("");
    const [tab, setTab] = React.useState<Tab>(() => {
        if (initialTab) return initialTab;
        const location_hash = window.location.hash.substring(1);
        if (location_hash === TabCreateAccount) return TabCreateAccount
        return TabLogin
    });

    const switchToLogin = useOnTabClick(TabLogin, setTab);
    const switchToCreateAccount = useOnTabClick(TabCreateAccount, setTab);

    return (
        <div className="card">
            <div className="card-header">
                <ul className="nav nav-tabs card-header-tabs nav-fill">
                    <li className="nav-item">
                        <button id="nav-button-login" className={getNavLinkClassName(TabLogin, tab)} onClick={switchToLogin}>
                            Log In
                        </button>
                    </li>
                    <li className="nav-item">
                        <button id="nav-button-create-account" className={getNavLinkClassName(TabCreateAccount, tab)} onClick={switchToCreateAccount}>
                            Create Account
                        </button>
                    </li>
                </ul>
            </div>
            <div className="card-body">
                {tab === TabLogin && (
                    <LoginForm
                        onAuthenticated={onAuthenticated}
                        email={email}
                        setEmail={setEmail}
                        password={password}
                        setPassword={setPassword}
                        switchToCreateAccount={switchToCreateAccount}
                    />
                )}
                {tab === TabCreateAccount && (
                    <CreateAccountForm
                        onAuthenticated={onAuthenticated}
                        email={email}
                        setEmail={setEmail}
                        password={password}
                        setPassword={setPassword}
                        switchToLogin={switchToLogin}
                    />
                )}
            </div>
        </div>
    );
};

export default LoginOrCreateAccountForm;
