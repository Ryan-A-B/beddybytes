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
        <div className="container">
            <h1 className="d-md-block d-none mx-auto text-center">
                Transform your devices!
            </h1>
            <div className="row">
                <div className="col-xl-4 col-lg-5 col-md-6 mt-5 mx-auto order-md-2">
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
                <div className="col-xl-4 col-lg-5 col-md-6 mt-5 mx-auto order-md-1">
                    <p>Baby Monitor by Creative Ilk is</p>
                    <ul>
                        <li>🔒<b>Private</b>: All video and audio is streamed directly between your own devices, no video or audio ever gets sent to our server</li>
                        <li>🧘<b>Flexible</b>: The number of cameras and monitors you can use is only limited by the number of devices you have, go wild</li>
                        <li>🚀<b>Fast</b>: Your video stream doesn't get sent to a data centre halfway around the world and back, meaning minimal delay, lag and buffering</li>
                        <li>✅<b>Efficient</b>: Your video stream is kept within your local network so internet bandwidth is dramatically reduced</li>
                    </ul>
                    <p>
                        We use this baby monitor multiple times a day, we hope you find it as useful as we have. <b>Try us out with a 7 day free trial (no credit card required).</b>
                    </p>
                    <a href="https://babymonitor.creativeilk.com" target="_blank" rel="noreferrer">
                        Click here to learn more
                    </a>
                </div>
            </div>
        </div>
    );
}

export default LoginOrCreateAccount
