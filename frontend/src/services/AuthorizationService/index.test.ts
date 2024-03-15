import settings from "../../settings";
import LoggingService from "../LoggingService/ConsoleLoggingService";
import AuthorizationService from ".";
import { randomUUID } from "crypto";

global.fetch = jest.fn().mockName('fetch');

afterEach(() => {
    localStorage.clear();
});

describe('AuthorizationService', () => {
    test('initialization', () => {
        const logging_service = new LoggingService();
        const authorization_service = new AuthorizationService({
            logging_service
        });
        const state = authorization_service.get_state();
        expect(state.state).toBe('no_account');
    });

    describe('create_account_and_login', () => {
        test('success', async () => {
            const account_id = randomUUID();
            const user_id = randomUUID();
            const email = `${randomUUID()}@${randomUUID()}.com`;
            const password = randomUUID();
            const anonymous_access_token = randomUUID();
            const access_token = randomUUID();

            const logging_service = new LoggingService();
            const authorization_service = new AuthorizationService({
                logging_service
            });

            // @ts-ignore
            mockCreateAccountAndLoginImplementation({
                account_id,
                user_id,
                email,
                password,
                anonymous_access_token,
                access_token,
            });

            await authorization_service.create_account_and_login(email, password);
            expect(fetch).toHaveBeenCalledTimes(3);
            const state = authorization_service.get_state();
            expect(state.state).toBe('token_fetched');
            if (state.state !== 'token_fetched') throw new Error('unexpected');
            expect(state.account.id).toBe(account_id);
            expect(state.account.user.id).toBe(user_id);
            expect(state.account.user.email).toBe(email);
        });

        // TODO get anonymous token fails should throw
        // TODO account already exists should throw
        // TODO login fails should throw
    });
    describe('login', () => {
        test('success', async () => {
            const account_id = randomUUID();
            const user_id = randomUUID();
            const email = `${randomUUID()}@${randomUUID()}.com`;
            const password = randomUUID();
            const access_token = randomUUID();

            const logging_service = new LoggingService();
            const authorization_service = new AuthorizationService({
                logging_service
            });
            // @ts-ignore
            mockLoginImplementation({
                account_id,
                user_id,
                email,
                password,
                access_token,
            });

            await authorization_service.login(email, password);
            expect(fetch).toHaveBeenCalledTimes(2);
            const state = authorization_service.get_state();
            expect(state.state).toBe('token_fetched');
            if (state.state !== 'token_fetched') throw new Error('unexpected');
            expect(state.account.id).toBe(account_id);
            expect(state.account.user.id).toBe(user_id);
            expect(state.account.user.email).toBe(email);
        });

        // TODO login fails should throw
        // TODO fetch account fails should throw
    });
    describe('get_access_token', () => {
        test('token_not_fetched', async () => {
            const account_id = randomUUID();
            const user_id = randomUUID();
            const email = `${randomUUID()}@${randomUUID()}.com`;
            {
                const password = randomUUID();
                const access_token = randomUUID();

                const logging_service = new LoggingService();
                const authorization_service = new AuthorizationService({
                    logging_service
                });
                // @ts-ignore
                mockLoginImplementation({
                    account_id,
                    user_id,
                    email,
                    password,
                    access_token,
                });
                await authorization_service.login(email, password);
                expect(fetch).toHaveBeenCalledTimes(2);
            }

            const logging_service = new LoggingService();
            const authorization_service = new AuthorizationService({
                logging_service
            });
            const initial_state = authorization_service.get_state();
            expect(initial_state.state).toBe('token_not_fetched');

            const access_token = randomUUID();
            mockRefreshTokenImplementation({ access_token });

            const actual_access_token = await authorization_service.get_access_token();
            expect(fetch).toHaveBeenCalledTimes(3);
            expect(actual_access_token).toBe(access_token);
            const state = authorization_service.get_state();
            expect(state.state).toBe('token_fetched');
            if (state.state !== 'token_fetched') throw new Error('unexpected');
            expect(state.account.id).toBe(account_id);
            expect(state.account.user.id).toBe(user_id);
            expect(state.account.user.email).toBe(email);
        });

        test('return current access token', async () => {
            const account_id = randomUUID();
            const user_id = randomUUID();
            const email = `${randomUUID()}@${randomUUID()}.com`;
            const password = randomUUID();
            const access_token = randomUUID();

            const logging_service = new LoggingService();
            const authorization_service = new AuthorizationService({
                logging_service
            });
            // @ts-ignore
            mockLoginImplementation({
                account_id,
                user_id,
                email,
                password,
                access_token,
            });

            await authorization_service.login(email, password);
            expect(fetch).toHaveBeenCalledTimes(2);
            {
                const state = authorization_service.get_state();
                expect(state.state).toBe('token_fetched');
                if (state.state !== 'token_fetched') throw new Error('unexpected');
                expect(state.account.id).toBe(account_id);
                expect(state.account.user.id).toBe(user_id);
                expect(state.account.user.email).toBe(email);
            }
            const actual_access_token = await authorization_service.get_access_token();
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(actual_access_token).toBe(access_token);
            {
                const state = authorization_service.get_state();
                expect(state.state).toBe('token_fetched');
                if (state.state !== 'token_fetched') throw new Error('unexpected');
                expect(state.account.id).toBe(account_id);
                expect(state.account.user.id).toBe(user_id);
                expect(state.account.user.email).toBe(email);
            }
        });

        test('expired token', async () => {
            const account_id = randomUUID();
            const user_id = randomUUID();
            const email = `${randomUUID()}@${randomUUID()}.com`;
            const password = randomUUID();

            const logging_service = new LoggingService();
            const authorization_service = new AuthorizationService({
                logging_service
            });
            // @ts-ignore
            mockLoginImplementation({
                account_id,
                user_id,
                email,
                password,
                access_token: randomUUID(),
                expires_in: -1,
            });

            await authorization_service.login(email, password);
            expect(fetch).toHaveBeenCalledTimes(2);
            {
                const state = authorization_service.get_state();
                expect(state.state).toBe('token_fetched');
                if (state.state !== 'token_fetched') throw new Error('unexpected');
                expect(state.account.id).toBe(account_id);
                expect(state.account.user.id).toBe(user_id);
                expect(state.account.user.email).toBe(email);
            }

            const access_token = randomUUID();
            mockRefreshTokenImplementation({ access_token });
            const actual_access_token = await authorization_service.get_access_token();
            expect(fetch).toHaveBeenCalledTimes(3);
            expect(actual_access_token).toBe(access_token);
            {
                const state = authorization_service.get_state();
                expect(state.state).toBe('token_fetched');
                if (state.state !== 'token_fetched') throw new Error('unexpected');
                expect(state.account.id).toBe(account_id);
                expect(state.account.user.id).toBe(user_id);
                expect(state.account.user.email).toBe(email);
            }
        });
    });
    describe('refresh_token', () => {
        test('unauthorized', async () => {
            const account_id = randomUUID();
            const user_id = randomUUID();
            const email = `${randomUUID()}@${randomUUID()}.com`;
            const password = randomUUID();

            const logging_service = new LoggingService();
            const authorization_service = new AuthorizationService({
                logging_service
            });
            // @ts-ignore
            mockLoginImplementation({
                account_id,
                user_id,
                email,
                password,
                access_token: randomUUID(),
                expires_in: -1,
            });
            await authorization_service.login(email, password);
            mockUnauthorizedRefreshTokenImplementation();
            try {
                await authorization_service.get_access_token();
                throw new Error('unexpected');
            } catch (error) {
                const isError = error instanceof Error;
                if (!isError) throw new Error('unexpected');
                expect(error.message).toBe('Failed to refresh token: 401 Unauthorized');
            }
            const state = authorization_service.get_state();
            expect(state.state).toBe('no_account');
        });
        test('backend unavailable', async () => {
            const account_id = randomUUID();
            const user_id = randomUUID();
            const email = `${randomUUID()}@${randomUUID()}.com`;
            const password = randomUUID();

            const logging_service = new LoggingService();
            const authorization_service = new AuthorizationService({
                logging_service
            });
            // @ts-ignore
            mockLoginImplementation({
                account_id,
                user_id,
                email,
                password,
                access_token: randomUUID(),
                expires_in: -1,
            });
            await authorization_service.login(email, password);
            mockRefreshTokenImplementationBadNetwork();
            const access_token = randomUUID();
            mockRefreshTokenImplementation({ access_token });
            await authorization_service.get_access_token();
            const state = authorization_service.get_state();
            expect(state.state).toBe('token_fetched');
        });
    });
});

type MockCreateAccountAndLoginImplementationInput = {
    account_id: string;
    user_id: string;
    email: string;
    password: string;
    anonymous_access_token: string;
    access_token: string;
}

const mockCreateAccountAndLoginImplementation = (input: MockCreateAccountAndLoginImplementationInput) => {
    // @ts-ignore
    global.fetch.mockImplementationOnce(async (url: string, init: RequestInit) => {
        if (url !== `https://${settings.API.host}/anonymous_token`)
            throw new Error(`unexpected url: ${url}`);
        return new Response(JSON.stringify({
            token_type: 'Bearer',
            access_token: input.anonymous_access_token,
        }), { status: 200 })
    });
    // @ts-ignore
    global.fetch.mockImplementationOnce(async (url: string, init: RequestInit) => {
        if (url !== `https://${settings.API.host}/accounts`)
            throw new Error(`unexpected url: ${url}`);

        expect(init.method).toBe('POST');
        expect(init.headers).not.toBeUndefined();
        if (init.headers === undefined) throw new Error('unexpected');
        for (const [key, value] of Object.entries(init.headers)) {
            if (key === 'Content-Type') expect(value).toBe('application/json');
            if (key === 'Authorization') expect(value).toBe(`Bearer ${input.anonymous_access_token}`);
        }
        expect(init.body).not.toBeUndefined();
        const payload = JSON.parse(init.body as string);
        expect(payload.email).toBe(input.email);
        expect(payload.password).toBe(input.password);
        return new Response(JSON.stringify({
            id: input.account_id,
            user: {
                id: input.user_id,
                email: input.email,
            },
        }), { status: 200 })
    });
    // @ts-ignore
    global.fetch.mockImplementationOnce(async (url: string, init: RequestInit) => {
        if (url !== `https://${settings.API.host}/token`)
            throw new Error(`unexpected url: ${url}`);
        expect(init.method).toBe('POST');
        expect(init.headers).not.toBeUndefined();
        if (init.headers === undefined) throw new Error('unexpected');
        for (const [key, value] of Object.entries(init.headers)) {
            if (key === 'Content-Type') expect(value).toBe('application/x-www-form-urlencoded');
        }
        expect(init.body).not.toBeUndefined();
        const payload = new URLSearchParams(init.body as string);
        expect(payload.get('grant_type')).toBe('password');
        expect(payload.get('username')).toBe(input.email);
        expect(payload.get('password')).toBe(input.password);
        return new Response(JSON.stringify({
            token_type: 'Bearer',
            access_token: randomUUID(),
            expires_in: 3600,
        }), { status: 200 })
    });
};

type MockLoginImplementationInput = {
    account_id: string;
    user_id: string;
    email: string;
    password: string;
    access_token: string;
    expires_in?: number;
}

const mockLoginImplementation = (input: MockLoginImplementationInput) => {
    // @ts-ignore
    global.fetch.mockImplementationOnce(async (url: string, init: RequestInit) => {
        if (url !== `https://${settings.API.host}/token`)
            throw new Error(`unexpected url: ${url}`);
        expect(init.method).toBe('POST');
        expect(init.headers).not.toBeUndefined();
        if (init.headers === undefined) throw new Error('unexpected');
        for (const [key, value] of Object.entries(init.headers)) {
            if (key === 'Content-Type') expect(value).toBe('application/x-www-form-urlencoded');
        }
        expect(init.body).not.toBeUndefined();
        const payload = new URLSearchParams(init.body as string);
        expect(payload.get('grant_type')).toBe('password');
        expect(payload.get('username')).toBe(input.email);
        expect(payload.get('password')).toBe(input.password);
        return new Response(JSON.stringify({
            token_type: 'Bearer',
            access_token: input.access_token,
            expires_in: input.expires_in || 3600,
        }), { status: 200 })
    });
    // @ts-ignore
    global.fetch.mockImplementationOnce(async (url: string, init: RequestInit) => {
        if (url !== `https://${settings.API.host}/accounts/current`)
            throw new Error(`unexpected url: ${url}`);
        expect(init.method).toBe('GET');
        expect(init.headers).not.toBeUndefined();
        if (init.headers === undefined) throw new Error('unexpected');
        for (const [key, value] of Object.entries(init.headers)) {
            if (key === 'Content-Type') expect(value).toBe('application/json');
            if (key === 'Authorization') expect(value).toBe(`Bearer ${input.access_token}`);
        }
        return new Response(JSON.stringify({
            id: input.account_id,
            user: {
                id: input.user_id,
                email: input.email,
            },
        }), { status: 200 })
    });
};

type MockRefreshTokenImplementationInput = {
    access_token: string;
    expires_in?: number;
}

const mockRefreshTokenImplementation = (input: MockRefreshTokenImplementationInput) => {
    // @ts-ignore
    global.fetch.mockImplementationOnce(async (url: string, init: RequestInit) => {
        if (url !== `https://${settings.API.host}/token`)
            throw new Error(`unexpected url: ${url}`);
        expect(init.method).toBe('POST');
        expect(init.headers).not.toBeUndefined();
        if (init.headers === undefined) throw new Error('unexpected');
        for (const [key, value] of Object.entries(init.headers)) {
            if (key === 'Content-Type') expect(value).toBe('application/x-www-form-urlencoded');
        }
        expect(init.credentials).toBe('include');
        expect(init.body).not.toBeUndefined();
        const payload = new URLSearchParams(init.body as string);
        expect(payload.get('grant_type')).toBe('refresh_token');
        return new Response(JSON.stringify({
            token_type: 'Bearer',
            access_token: input.access_token,
            expires_in: input.expires_in || 3600,
        }), { status: 200 })
    });
}

const mockUnauthorizedRefreshTokenImplementation = () => {
    // @ts-ignore
    global.fetch.mockImplementationOnce(async (url: string, init: RequestInit) => {
        if (url !== `https://${settings.API.host}/token`)
            throw new Error(`unexpected url: ${url}`);
        return new Response('Unauthorized', {
            statusText: 'Unauthorized',
            status: 401,
        })
    });
}

const mockRefreshTokenImplementationBadNetwork = () => {
    // @ts-ignore
    global.fetch.mockImplementationOnce(async (url: string, init: RequestInit) => {
        if (url !== `https://${settings.API.host}/token`)
            throw new Error(`unexpected url: ${url}`);
        throw new Error('network error');
    });
}
