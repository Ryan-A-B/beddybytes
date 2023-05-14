import React from 'react';

export interface LoginFrame {
    accessToken: string
    refreshToken: string
}

export interface AuthorizationServer {
    login: (username: string, password: string) => Promise<LoginFrame>
    refresh: (refreshToken: string) => Promise<LoginFrame>
}

export class MockAuthorizationServer implements AuthorizationServer {
    private expectedUsername = 'someone'
    private expectedPassword = 'password'
    private expectedRefreshToken = 'refresh-token'

    login = async (username: string, password: string) => {
        if (username !== this.expectedUsername)
            throw new Error(`Wrong username, try "${this.expectedUsername}"`)
        if (password !== this.expectedPassword)
            throw new Error(`Invalid password, try "${this.expectedPassword}"`)
        return {
            accessToken: 'access-token',
            refreshToken: this.expectedRefreshToken,
        }
    }

    refresh = async (refreshToken: string) => {
        if (refreshToken !== this.expectedRefreshToken)
            throw new Error('Invalid refresh token')
        return {
            accessToken: 'access-token',
            refreshToken: this.expectedRefreshToken,
        }
    }
}

export const Context = React.createContext<AuthorizationServer | null>(null);

export const useAuthorizationServer = () => {
    const authorizationServer = React.useContext(Context)
    if (!authorizationServer) throw new Error('No authorization server provided')
    return authorizationServer
}
