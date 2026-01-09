import React, { useState } from 'react';
import Input from '../../components/Input';
import { useAuthorizationService } from '../../services';

const RequestPasswordReset: React.FunctionComponent = () => {
    const authorization_service = useAuthorizationService();
    const [email, setEmail] = useState<string>("");
    const [message, setMessage] = useState<string | null>(null);
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(null);
        try {
            await authorization_service.authorization_client.request_password_reset(email);
            setMessage("Password reset email sent. Please check your inbox.");
        } catch (error) {
            if (error instanceof Error)
                setMessage(error.message);
            else
                setMessage("An unknown error occurred.");
        }
    };
    return (
        <div className="container wrapper-content">
            <h1 className="d-md-block d-none mx-auto text-center">Request Password Reset</h1>
            <div className="row">
                <div className="col-xl-4 col-lg-5 col-md-6 mt-5 mx-auto">
                    <div className="card">
                        <div className="card-body">
                            <form id="form-request-password-reset" onSubmit={handleSubmit} className="was-validated">
                                <div className="form-group mb-3">
                                    <label>Email:</label>
                                    <Input
                                        id="input-request-password-reset-email"
                                        type="email"
                                        name="email"
                                        value={email}
                                        onChange={setEmail}
                                        autoComplete="email"
                                        className="form-control"
                                        autoFocus
                                        required
                                    />
                                </div>
                                {message && <div className="alert alert-info">{message}</div>}
                                <button id="submit-button-request-password-reset" type="submit" className="btn btn-primary w-100">
                                    Request Password Reset
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequestPasswordReset;
