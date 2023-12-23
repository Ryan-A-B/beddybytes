import { render } from '@testing-library/react';
import { Services, context as ServicesContext } from '../../services';
import Monitor from '.';
import ConsoleLoggingService from '../../services/LoggingService/ConsoleLoggingService';

describe('Monitor', () => {
    describe('when there are no sessions', () => {
        it('should not show stream', () => {
            const services: any = {
                logging_service: new ConsoleLoggingService(),
                client_session_service: null,
                session_list_service: null,
            }
            const component = render(
                <ServicesContext.Provider value={services as Services}>
                    <Monitor />
                </ServicesContext.Provider>
            );
            expect(component.baseElement.tagName).toEqual('DIV');
        });
    })
});
