import React from 'react';

export interface LoginFrame {
    token_type: string
    access_token: string
    expires_in: number
}

export interface AuthorizationServer {
    createAccount: (email: string, password: string) => Promise<void>
    login: (email: string, password: string) => Promise<LoginFrame>
    refresh: () => Promise<LoginFrame>
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

    refresh = async () => {
        throw new Error('Not implemented')
    }
}

export class AuthorizationServerAPI implements AuthorizationServer {
    private baseURL: string

    constructor(baseURL: string) {
        this.baseURL = baseURL
    }

    createAccount = async (email: string, password: string) => {
        const response = await fetch(`${this.baseURL}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password
            }),
            credentials: 'include',
        })
        if (!response.ok) {
            const payload = await response.text()
            throw new Error(`Failed to create account: ${payload}`)
        }
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
            throw new Error(`Failed to login: ${response.statusText}`)
        }
        return response.json()
    }

    refresh = async () => {
        const response = await fetch(`${this.baseURL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                // expects refresh token to be stored in httpOnly cookie
            }),
            credentials: 'include',
        })
        if (!response.ok) {
            throw new Error(`Failed to refresh token: ${response.statusText}`)
        }
        return response.json()
    }
}

export const Context = React.createContext<AuthorizationServer | null>(null);

export const useAuthorizationServer = () => {
    const authorizationServer = React.useContext(Context)
    if (!authorizationServer) throw new Error('No authorization server provided')
    return authorizationServer
}

export const AuthorizationContext = React.createContext<string | null>(null);

export const useAuthorization = () => {
    const authorization = React.useContext(AuthorizationContext)
    if (!authorization) throw new Error('No authorization provided')
    return authorization
}
