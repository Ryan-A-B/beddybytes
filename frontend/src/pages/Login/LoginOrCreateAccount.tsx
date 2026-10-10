import React from "react";
import LoginOrCreateAccountForm from "./LoginOrCreateAccountForm";

const LoginOrCreateAccount: React.FC = () => {
    return (
        <div className="container wrapper-content">
            <h1 className="d-md-block d-none mx-auto text-center">
                Transform your devices!
            </h1>
            <div className="row">
                <div className="col-xl-4 col-lg-5 col-md-6 mt-5 mx-auto order-md-2">
                    <LoginOrCreateAccountForm />
                </div>
                <div className="col-xl-4 col-lg-5 col-md-6 mt-5 mx-auto order-md-1">
                    <p>BeddyBytes is</p>
                    <ul>
                        <li>🔒<b>Private</b>: All video and audio is streamed directly between your own devices, no video or audio ever gets sent to our server</li>
                        <li>🧘<b>Flexible</b>: The number of baby and parent stations you can use is only limited by the number of devices you have, go wild</li>
                        <li>🚀<b>Fast</b>: Your video stream doesn't get sent to a data centre halfway around the world and back, meaning minimal delay, lag and buffering</li>
                        <li>✅<b>Efficient</b>: Your video stream is kept within your local network so internet bandwidth is dramatically reduced</li>
                    </ul>
                    <p>
                        We use BeddyBytes multiple times a day, we hope you find it as useful as we have.
                    </p>
                    <a href="https://beddybytes.com" target="_blank" rel="noreferrer">
                        Click here to learn more
                    </a>
                </div>
            </div>
        </div>
    );
}

export default LoginOrCreateAccount
