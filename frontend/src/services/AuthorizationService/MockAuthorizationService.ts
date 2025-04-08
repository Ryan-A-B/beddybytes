import Service from '../Service';
import LoggingService from '../LoggingService';

interface NewMockAuthorizationServiceInput {
    logging_service: LoggingService;
    initial_state: AuthorizationState;
}

class MockAuthorizationService extends Service<AuthorizationState> implements AuthorizationService {
    protected readonly name: string = 'mock_authorization_service';

    constructor(input: NewMockAuthorizationServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: input.initial_state,
        })
    }

    protected to_string = (state: AuthorizationState): string => {
        return state.state;
    }

    public create_account_and_login = async (email: string, password: string) => {

    }

    public login = async (email: string, password: string) => {

    }

    public get_access_token = async (): Promise<string> => {
        return "";
    }
}

export default MockAuthorizationService;