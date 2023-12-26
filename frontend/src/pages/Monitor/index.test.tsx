import { render } from '@testing-library/react';
import { Services, context as ServicesContext } from '../../services';
import Monitor from '.';
import ConsoleLoggingService from '../../services/LoggingService/ConsoleLoggingService';
import MockClientSessionService from '../../services/ClientSessionService/MockClientSessionService';
import MockSessionListService from '../../services/SessionListService/MockSessionListService';
import MockSignalService from '../../services/SignalService/MockSignalService';

describe('Monitor', () => {
    describe('when there are no sessions', () => {
        it('should not show stream', () => {
            const logging_service = new ConsoleLoggingService();
            const signal_service = new MockSignalService();
            const client_session_service = new MockClientSessionService();
            const session_list_service = new MockSessionListService();
            const services: any = {
                logging_service,
                signal_service,
                client_session_service,
                session_list_service,
            }
            const component = render(
                <ServicesContext.Provider value={services as Services}>
                    <Monitor />
                </ServicesContext.Provider>
            );
            const body = component.baseElement;
            expect(body.querySelector('div')).not.toBeNull();
        });
    })
});
