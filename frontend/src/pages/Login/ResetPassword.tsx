import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PasswordInput from '../../components/PasswordInput';
import { useAuthorizationService } from '../../services';

const ResetPassword: React.FunctionComponent = () => {
    const authorization_service = useAuthorizationService();
    const [password, setPassword] = useState<string>("");
    const [message, setMessage] = useState<JSX.Element | null>(null);
    const location = useLocation();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(null);
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        if (!token) {
            setMessage(<React.Fragment>Invalid or missing token.</React.Fragment>);
            return;
        }
        try {
            await authorization_service.authorization_client.reset_password({
                token,
                password
            });
            setMessage(
                <React.Fragment>
                    Password reset successful. <Link to="/">Back to login</Link>
                </React.Fragment>
            );
            // setTimeout(() => history.push('/login'), 3000);
        } catch (error) {
            if (error instanceof Error)
                setMessage(<React.Fragment>{error.message}</React.Fragment>);
            else
                setMessage(<React.Fragment>An unknown error occurred.</React.Fragment>);
        }
    };

    return (
        <div className="container wrapper-content">
            <h1 className="d-md-block d-none mx-auto text-center">Reset Password</h1>
            <div className="row">
                <div className="col-xl-4 col-lg-5 col-md-6 mt-5 mx-auto">
                    <div className="card">
                        <div className="card-body">
                            <form id="form-reset-password" onSubmit={handleSubmit} className="was-validated">
                                <div className="form-group mb-3">
                                    <label>New Password:</label>
                                    <PasswordInput
                                        id="input-reset-password-password"
                                        name="password"
                                        value={password}
                                        onChange={setPassword}
                                        autoComplete="new-password"
                                        className="form-control"
                                        minLength={20}
                                        required
                                    />
                                    <div className="form-text">At least 20 characters required.</div>
                                </div>
                                {message && <div className="alert alert-info">{message}</div>}
                                <button id="submit-button-reset-password" type="submit" className="btn btn-primary w-100">
                                    Reset Password
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;

