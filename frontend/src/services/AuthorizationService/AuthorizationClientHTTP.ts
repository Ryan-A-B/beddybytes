import settings from "../../settings";
import isClientError from '../../utils/isClientError';
import sleep from '../../utils/sleep';
import LoggingService, { Severity } from "../LoggingService";
import { Account } from "./Account";
import { AuthorizationClient, ResetPasswordInput, TokenOutput } from "./AuthorizationClient";

interface AuthorizationClientHTTPInput {
    logging_service: LoggingService;
}

class AuthorizationClientHTTP implements AuthorizationClient {
    public static readonly MaxRetryDelay = 2 * 60 * 1000;
    public readonly logging_service: LoggingService;

    constructor(input: AuthorizationClientHTTPInput) {
        this.logging_service = input.logging_service;
    }

    login = async (email: string, password: string): Promise<TokenOutput> => {
        const response = await fetch(`https://${settings.API.host}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "password",
                username: email,
                password,
            }),
            credentials: "include",
        })
        if (isClientError(response.status))
            throw new Error(`Failed to login: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            const payload = await response.text()
            throw new Error(`Failed to login: ${payload}`)
        }
        return await response.json() as TokenOutput;
    }

    get_current_account = async (access_token: string): Promise<Account> => {
        const response = await fetch(`https://${settings.API.host}/accounts/current`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${access_token}`
            },
        });
        if (!response.ok) {
            const payload = await response.text()
            throw new Error(`Failed to fetch account: ${payload}`);
        }
        return await response.json() as Account;
    }

    refresh_token = async (): Promise<TokenOutput> => {
        this.logging_service.log({
            severity: Severity.Informational,
            message: `Refreshing token`
        })
        const response = await fetch(`https://${settings.API.host}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                // expects refresh token to be stored in httpOnly cookie
            }),
            // include credentials to send httpOnly cookie
            credentials: 'include',
        });
        if (isClientError(response.status))
            throw new ClientError(response.status, response.statusText);
        if (!response.ok)
            throw new Error(`Failed to refresh token: ${response.status} ${response.statusText}`);
        return response.json();
    }

    refresh_token_with_retry = async (retry_delay: number): Promise<TokenOutput> => {
        try {
            return await this.refresh_token();
        } catch (error) {
            if (error instanceof ClientError)
                throw error;
            const isError = error instanceof Error;
            if (!isError)
                throw error;
            this.logging_service.log({
                severity: Severity.Warning,
                message: `Failed to refresh token: ${error.message}, retrying in ${retry_delay}ms`
            })
            await sleep(retry_delay);
            let next_retry_delay = retry_delay * 2;
            if (next_retry_delay > AuthorizationClientHTTP.MaxRetryDelay)
                next_retry_delay = AuthorizationClientHTTP.MaxRetryDelay;
            return this.refresh_token_with_retry(next_retry_delay);
        }
    }

    private get_anonymous_token = async (scope: string): Promise<string> => {
        const tokenResponse = await fetch(`https://${settings.API.host}/anonymous_token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ scope }),
        })
        if (!tokenResponse.ok) {
            const payload = await tokenResponse.text()
            throw new Error(`Failed to create account: ${payload}`)
        }
        const { token_type, access_token } = await tokenResponse.json()
        if (token_type !== "Bearer")
            throw new Error(`Failed to create account: invalid token type ${token_type}`)
        return access_token
    }

    create_account = async (email: string, password: string): Promise<Account> => {
        const access_token = await this.get_anonymous_token("iam:CreateAccount");
        const response = await fetch(`https://${settings.API.host}/accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`
            },
            body: JSON.stringify({
                email,
                password
            }),
        });
        if (!response.ok) {
            const payload = await response.text();
            throw new Error(`Failed to create account: ${payload}`);
        }
        return await response.json() as Account;
    }

    request_password_reset = async (email: string): Promise<void> => {
        const access_token = await this.get_anonymous_token("iam:RequestPasswordReset");
        const response = await fetch(`https://${settings.API.host}/request-password-reset`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${access_token}`,
            },
            body: JSON.stringify({ email }),
        });
        if (!response.ok) {
            const payload = await response.text();
            throw new Error(`Failed to request password reset: ${payload}`);
        }
    }

    reset_password = async (input: ResetPasswordInput): Promise<void> => {
        const access_token = await this.get_anonymous_token("iam:ResetPassword");
        const response = await fetch(`https://${settings.API.host}/reset-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${access_token}`,
            },
            body: JSON.stringify(input),
        });
        if (!response.ok) {
            const payload = await response.text();
            throw new Error(`Failed to reset password: ${payload}`);
        }
    }
}

class ClientError extends Error {
    public constructor(status: number, statusText: string) {
        super(`Failed to refresh token: ${status} ${statusText}`);
    }
}

export default AuthorizationClientHTTP;