export interface AuthorizationClient {
    create_account(email: string, password: string): Promise<Account>;
    login(email: string, password: string): Promise<TokenOutput>;
    get_current_account(access_token: string): Promise<Account>;
    refresh_token(): Promise<TokenOutput>;
    refresh_token_with_retry(retry_delay: number): Promise<TokenOutput>;
}

export interface TokenOutput {
    token_type: string;
    access_token: string;
    expires_in: number;
}