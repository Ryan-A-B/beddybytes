// For callers who ask for an access token before the user has logged in
const get_access_token_asap = async (authorization_service: AuthorizationService) => {
    const authorization_state = authorization_service.get_state();
    if (authorization_state.state !== 'no_account')
        return authorization_service.get_access_token();
    const wait_for_account = new Promise<void>((resolve) => {
        const handle = () => {
            const authorization_state = authorization_service.get_state();
            if (authorization_state.state === 'no_account')
                return;
            resolve();
            authorization_service.removeEventListener('statechange', handle);
        };
        authorization_service.addEventListener('statechange', handle);
    });
    await wait_for_account;
    return authorization_service.get_access_token();
}

export default get_access_token_asap;