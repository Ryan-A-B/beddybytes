// interface AuthorizationService extends EventTarget {
//     create_account_and_login: (email: string, password: string) => Promise<void>
//     login: (email: string, password: string) => Promise<void>
//     get_access_token: () => Promise<string>
//     get_state: () => AuthorizationState
// }

// interface AuthorizationStateNoAccount {
//     state: 'no_account';
// }

// interface AuthorizationStateTokenNotFetched {
//     state: 'token_not_fetched';
//     account: Account;
// }

// interface AuthorizationStateRefreshingToken {
//     state: 'refreshing_token';
//     account: Account;
//     promise: Promise<TokenOutput>;
// }

// interface AuthorizationStateTokenFetched {
//     state: 'token_fetched';
//     account: Account;
//     access_token: string;
//     expiry: moment.Moment;
// }

// type AuthorizationState = AuthorizationStateNoAccount | AuthorizationStateTokenNotFetched | AuthorizationStateRefreshingToken | AuthorizationStateTokenFetched;

// type TokenOutput = {
//     token_type: string;
//     access_token: string;
//     expires_in: number;
// }

// interface AccountStatusNoAccount {
//     status: 'no_account'
// }

// interface AccountStatusHaveAccount {
//     status: 'have_account'
//     account: Account
// }

// type AccountStatus = AccountStatusNoAccount | AccountStatusHaveAccount;