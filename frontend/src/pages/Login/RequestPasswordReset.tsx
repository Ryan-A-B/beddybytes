import React, { useState } from 'react';
import Input from '../../components/Input';
import { get_anonymous_token } from '../../services/AuthorizationService';
import settings from '../../settings';

const RequestPasswordReset: React.FunctionComponent = () => {
    const [email, setEmail] = useState<string>("");
    const [message, setMessage] = useState<string | null>(null);
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            await request_password_reset(email);
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

const request_password_reset = async (email: string) => {
    const access_token = await get_anonymous_token();
    const response = await fetch(`https://${settings.API.host}/request-password-reset`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`,
        },
        body: JSON.stringify({ email }),
    });
    if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Failed to request password reset: ${payload}`);
    }
}
