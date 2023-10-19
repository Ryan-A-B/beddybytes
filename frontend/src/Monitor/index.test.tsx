import { render, fireEvent } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { v4 as uuid } from 'uuid';

import Monitor from '.';
import SessionsMock from '../Sessions/SessionsMock';
import MockConnectionFactory from './Connection/MockConnectionFactory';

export default MockConnectionFactory;

describe('Monitor', () => {
    describe('should render correctly', () => {
        it('when there are no sessions', async () => {
            const mockConnectionFactory = new MockConnectionFactory();
            mockConnectionFactory.create = jest.fn(mockConnectionFactory.create)

            const mockSessions = new SessionsMock();
            const component = render(
                <Monitor factory={mockConnectionFactory} sessions={mockSessions} />
            );

            const body = component.baseElement;
            const div = body.querySelector(`div.monitor`);
            if (div === null) throw new Error(`div not found`);
            expect(div.textContent).toEqual('No sessions found');

            expect(mockConnectionFactory.create).toHaveBeenCalledTimes(0);
        });
        it('when there are sessions', async () => {
            const mockConnectionFactory = new MockConnectionFactory()
            jest.spyOn(mockConnectionFactory, 'create');

            const mockSessions = new SessionsMock();
            const clientID = uuid();
            const sessionName = uuid();
            const session = await mockSessions.start({
                host_connection_id: clientID,
                session_name: sessionName,
            });
            const component = render(
                <Monitor factory={mockConnectionFactory} sessions={mockSessions} />
            );

            await act(async () => { });
            expect(mockConnectionFactory.create).toHaveBeenCalledTimes(0);

            const body = component.baseElement;
            const div = body.querySelector(`div.monitor`);
            if (div === null) throw new Error(`div not found`);
            const sessionDropdown = div.querySelector(`select`);
            if (sessionDropdown === null) throw new Error(`sessionDropdown not found`);
            fireEvent.change(sessionDropdown, { target: { value: session.id } });

            expect(mockConnectionFactory.create).toHaveBeenCalledTimes(1);
        });
    })
});
