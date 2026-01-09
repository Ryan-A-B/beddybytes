import Service, { EventTypeStateChanged, ServiceState } from "../Service";
import LoggingService from "../LoggingService/ConsoleLoggingService";
import { AuthorizationClient, TokenOutput } from "./AuthorizationClient";
import AuthorizationService from "."
import sleep from "../../utils/sleep";

const default_account: Account = {
    id: 'test_id',
    user: {
        id: 'user_id',
        email: 'test@example.com',
        password_salt: 'salt',
        password_hash: 'hash',
    },
};

const default_token_output: TokenOutput = {
    token_type: 'Bearer',
    access_token: 'test_access_token',
    expires_in: 3600,
};

const make_default_authorization_client: () => AuthorizationClient = () => ({
    create_account: jest.fn((email: string, password: string): Promise<Account> => {
        return sleep(10).then(() => default_account);
    }),
    login: jest.fn((email: string, password: string): Promise<TokenOutput> => {
        return sleep(10).then(() => default_token_output);
    }),
    get_current_account: jest.fn((access_token: string): Promise<Account> => {
        return sleep(10).then(() => default_account);
    }),
    refresh_token: jest.fn(),
    refresh_token_with_retry: jest.fn(),
});

const new_authorization_service = (authorization_client: AuthorizationClient = make_default_authorization_client()) => {
    const logging_service = new LoggingService();
    return new AuthorizationService({
        logging_service: new LoggingService(),
        authorization_client: authorization_client,
    });
}

describe('AuthorizationService', () => {
    // describe('initial_state', () => {
    //     test('no account in local storage', () => {
    //         localStorage.removeItem('account');
    //         const authorization_service = new_authorization_service();
    //         expect(authorization_service.get_state().name).toBe('Unauthorized');
    //     });
    //     test('account in local storage', () => {
    //         const account = {
    //             id: 'test_id',
    //             user: {
    //                 id: 'user_id',
    //                 email: 'test@example.com',
    //             }
    //         };
    //         localStorage.setItem('account', JSON.stringify(account));
    //         const authorization_service = new_authorization_service();
    //         expect(authorization_service.get_state().name).toBe('RefreshingA');
    //     });
    // });
    describe('when unauthorized', () => {
        beforeEach(() => {
            localStorage.removeItem('account');
        });
        // test('get_access_token throws error', async () => {
        //     const authorization_service = new_authorization_service();
        //     expect(() => {
        //         authorization_service.get_access_token();
        //     }).toThrowError('can not get access token in Unauthorized state');
        // });
        describe('create_account_and_login', () => {
            // test('success', async () => {
            //     const authorization_client = make_default_authorization_client();
            //     const authorization_service = new_authorization_service(authorization_client);
            //     authorization_service.create_account_and_login('test@example.com', 'password');
            //     expect(authorization_service.get_state().name).toBe('CreatingAccount');
            //     await wait_for_state_change(authorization_service);
            //     expect(authorization_service.get_state().name).toBe('LoggingIn');
            //     await wait_for_state_change(authorization_service);
            //     expect(authorization_service.get_state().name).toBe('Authorized');

            //     expect(authorization_client.create_account).toHaveBeenCalledTimes(1);
            //     expect(authorization_client.login).toHaveBeenCalledTimes(1);
            // });
            describe('failure', () => {
                // test('create_account fails', async () => {
                //     const authorization_client = {
                //         ...make_default_authorization_client(),
                //         create_account: jest.fn((email: string, password: string) => {
                //             return sleep(10).then(() => {
                //                 throw new Error('Email already in use');
                //             });
                //         }),
                //     }
                //     const authorization_service = new_authorization_service(authorization_client);
                //     const create_account_and_login_promise = authorization_service.create_account_and_login('test@example.com', 'password');
                //     expect(authorization_service.get_state().name).toBe('CreatingAccount');
                //     expect(create_account_and_login_promise).rejects.toThrow('Email already in use');
                //     await wait_for_state_change(authorization_service);
                //     expect(authorization_service.get_state().name).toBe('Unauthorized');

                //     expect(authorization_client.create_account).toHaveBeenCalledTimes(1);
                //     expect(authorization_client.login).toHaveBeenCalledTimes(0);
                // });
                test('login fails', async () => {
                    const authorization_client = {
                        ...make_default_authorization_client(),
                        login: jest.fn((email: string, password: string) => {
                            return sleep(10).then(() => {
                                throw new Error('Invalid credentials');
                            });
                        }),
                    }
                    const authorization_service = new_authorization_service(authorization_client);
                    const create_account_and_login_promise = authorization_service.create_account_and_login('test@example.com', 'password');
                    expect(authorization_service.get_state().name).toBe('CreatingAccount');
                    await wait_for_state_change(authorization_service);
                    expect(authorization_service.get_state().name).toBe('LoggingIn');
                    expect(create_account_and_login_promise).rejects.toThrow('Invalid credentials');
                    await wait_for_state_change(authorization_service);
                    expect(authorization_service.get_state().name).toBe('Unauthorized');
                    

                    expect(authorization_client.create_account).toHaveBeenCalledTimes(1);
                    expect(authorization_client.login).toHaveBeenCalledTimes(1);
                });
            });
        });
        // describe('login', () => {
        //     test('success', async () => {
        //         const authorization_client = make_default_authorization_client();
        //         const authorization_service = new_authorization_service(authorization_client);
        //         authorization_service.login('test@example.com', 'password');
        //         expect(authorization_service.get_state().name).toBe('LoggingIn');
        //         await wait_for_state_change(authorization_service);
        //         expect(authorization_service.get_state().name).toBe('Authorized');

        //         expect(authorization_client.login).toHaveBeenCalledTimes(1);
        //     });
        //     test('failure', async () => {
        //         const authorization_client = {
        //             ...make_default_authorization_client(),
        //             login: jest.fn((email: string, password: string) => {
        //                 return Promise.reject(new Error('Invalid credentials'));
        //             }),
        //         }
        //         const authorization_service = new_authorization_service(authorization_client);
        //         const login_promise = authorization_service.login('', '');
        //         expect(authorization_service.get_state().name).toBe('LoggingIn');
        //         expect(login_promise).rejects.toThrow('Invalid credentials');
        //         await wait_for_state_change(authorization_service);
        //         expect(authorization_service.get_state().name).toBe('Unauthorized');

        //         expect(authorization_client.login).toHaveBeenCalledTimes(1);
        //     });
        // });
    });
    // describe('when authorized', () => {
    //     beforeEach(() => {
    //         localStorage.removeItem('account');
    //     });
    //     test('get_access_token returns access token', async () => {
    //         const authorization_client = make_default_authorization_client();
    //         const authorization_service = new_authorization_service(authorization_client);
    //         authorization_service.login('test@example.com', 'password');
    //         await wait_for_state_change(authorization_service);
    //         const access_token = await authorization_service.get_access_token();
    //         expect(access_token).toBe('test_access_token');
    //     });
    //     test('create_account_and_login throws error', async () => {
    //         const authorization_client = make_default_authorization_client();
    //         const authorization_service = new_authorization_service(authorization_client);
    //         authorization_service.login('test@example.com', 'password');
    //         await wait_for_state_change(authorization_service);
    //         await expect(authorization_service.create_account_and_login('another@example.com', 'newpassword')).rejects.toThrow();
    //     });
    //     test('login throws error', async () => {
    //         const authorization_client = make_default_authorization_client();
    //         const authorization_service = new_authorization_service(authorization_client);
    //         authorization_service.login('test@example.com', 'password');
    //         await wait_for_state_change(authorization_service);
    //         await expect(authorization_service.login('another@example.com', 'newpassword')).rejects.toThrow();
    //     });
    // });
});

async function wait_for_state_change<T extends ServiceState>(service: Service<T>): Promise<T> {
    return new Promise((resolve) => {
        service.addEventListener(EventTypeStateChanged, () => {
            resolve(service.get_state());
        });
    });
}