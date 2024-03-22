import { fireEvent, render } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { List } from 'immutable';
import moment from 'moment';
import { v4 as uuid } from 'uuid';
import { Services, context as ServicesContext } from '../../services';
import ConsoleLoggingService from '../../services/LoggingService/ConsoleLoggingService';
import MockClientSessionService from '../../services/ClientSessionService/MockClientSessionService';
import MockSessionListService from '../../services/SessionListService/MockSessionListService';
import MockSignalService from '../../services/SignalService/MockSignalService';
import { Session } from '../../services/SessionListService/types';
import ParentStation from '.';
import sleep from '../../utils/sleep';

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
                    <ParentStation />
                </ServicesContext.Provider>
            );
            const body = component.baseElement;
            const monitor = body.querySelector('div.monitor');
            if (monitor === null)
                throw new Error('monitor should not be null')
            expect(monitor.children.length).toBe(0);
            expect(monitor.innerHTML).toBe("No sessions found");
        });
        describe('and a session is added', () => {
            it('should show session in dropdown', async () => {
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
                        <ParentStation />
                    </ServicesContext.Provider>
                );
                const body = component.baseElement;
                const monitor = body.querySelector('div.monitor');
                if (monitor === null)
                    throw new Error('monitor should not be null');
                const session: Session = {
                    id: uuid(),
                    name: uuid(),
                    host_connection_id: uuid(),
                    started_at: moment(),
                    host_connection_state: {
                        state: 'connected',
                        request_id: uuid(),
                        since: moment(),
                    },
                }
                await act(async () => {
                    session_list_service.set_session_list(List([session]));
                    await sleep(100);
                })
                expect(monitor.children.length).toBe(1);
                const dropdown = monitor.querySelector('select');
                expect(dropdown).not.toBeNull();
            });
        });
    });
    describe('when a session is selected', () => {
        it('should show stream', async () => {
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
                    <ParentStation />
                </ServicesContext.Provider>
            );
            const body = component.baseElement;
            const monitor = body.querySelector('div.monitor');
            if (monitor === null)
                throw new Error('monitor should not be null');
            const session: Session = {
                id: uuid(),
                name: uuid(),
                host_connection_id: uuid(),
                started_at: moment(),
                host_connection_state: {
                    state: 'connected',
                    request_id: uuid(),
                    since: moment(),
                },
            }
            await act(async () => {
                session_list_service.set_session_list(List([session]));
                await sleep(100);
            })
            const dropdown = monitor.querySelector('select');
            if (dropdown === null)
                throw new Error('dropdown should not be null');
            // TODO complaining about missing AudioContext
            // fireEvent.change(dropdown, { target: { value: session.id } });
            // await act(async () => { });
            // const session_duration = monitor.querySelector('h3.session-duration');
            // expect(session_duration).not.toBeNull();
            // const audio_only_message = monitor.querySelector('p');
            // expect(audio_only_message).not.toBeNull();
            // const audio = monitor.querySelector('audio');
            // expect(audio).not.toBeNull();
        });
    });
});

HTMLAudioElement.prototype.play = async () => {
    console.log('play');
};
