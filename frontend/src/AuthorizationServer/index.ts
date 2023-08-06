import React from 'react';
import settings from "../settings"

export interface LoginFrame {
    token_type: string
    access_token: string
    expires_in: number
}

export interface ErrorFrame {
    code: string
    message: string
}

export interface AuthorizationServer {
    createAccount: (email: string, password: string) => Promise<void>
    login: (email: string, password: string) => Promise<LoginFrame>
}

export class MockAuthorizationServer implements AuthorizationServer {
    private accounts: { [email: string]: string } = {}

    createAccount = async (email: string, password: string) => {
        if (this.accounts[email])
            throw new Error(`Account already exists for ${email}`)
        this.accounts[email] = password
    }

    login = async (email: string, password: string) => {
        if (!this.accounts[email])
            throw new Error(`No account exists for ${email}`)
        if (this.accounts[email] !== password)
            throw new Error(`Incorrect password for ${email}`)
        return {
            token_type: 'Bearer',
            access_token: 'mock-access-token',
            expires_in: 3600,
        }
    }
}

export class AuthorizationServerAPI implements AuthorizationServer {
    private baseURL: string

    constructor(baseURL: string) {
        this.baseURL = baseURL
    }

    getAnonymousToken = async () => {
        const tokenResponse = await fetch(`${this.baseURL}/anonymous_token`, {
            method: 'POST',
        })
        if (!tokenResponse.ok) {
            const payload = await tokenResponse.text()
            throw new Error(`Failed to create account: ${payload}`)
        }
        const { token_type, access_token } = await tokenResponse.json()
        if (token_type !== 'Bearer')
            throw new Error(`Failed to create account: invalid token type ${token_type}`)
        return access_token
    }
    
    // TODO return Result<Account, ErrorFrame>
    createAccount = async (email: string, password: string) => {
        const accessToken = await this.getAnonymousToken()
        const createAccountResponse = await fetch(`${this.baseURL}/accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                email,
                password
            }),
            credentials: 'include',
        })
        if (!createAccountResponse.ok) {
            const payload = await createAccountResponse.json()
            throw payload as ErrorFrame
        }
        // TODO payload as account?
    }

    login = async (email: string, password: string) => {
        const response = await fetch(`${this.baseURL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'password',
                username: email,
                password,
            }),
            credentials: 'include',
        })
        if (!response.ok) {
            const payload = await response.text()
            throw new Error(`Failed to login: ${payload}`)
        }
        return response.json()
    }
}

export const Context = React.createContext<AuthorizationServer | null>(null);

export const useAuthorizationServer = (): AuthorizationServer => {
    const { API: { host } } = settings
    return React.useMemo(() => {
        return new AuthorizationServerAPI(`https://${host}`)
    }, [host])
}
