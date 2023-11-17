import { render, fireEvent } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { List } from 'immutable';
import { v4 as uuid } from 'uuid';
import moment from 'moment';

import Monitor from '.';
import MockConnectionFactory from './Connection/MockConnectionFactory';
import { Session } from '../../services/SessionListService';

export default MockConnectionFactory;

const RFC3339 = 'YYYY-MM-DDTHH:mm:ssZ';

describe('Monitor', () => {
    describe('should render correctly', () => {
        it('when there are no sessions', async () => {
            const mockConnectionFactory = new MockConnectionFactory();
            mockConnectionFactory.create = jest.fn(mockConnectionFactory.create)

            const session_list = List<Session>()
            const component = render(
                <Monitor factory={mockConnectionFactory} session_list={session_list} />
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

            const session: Session = {
                id: uuid(),
                name: uuid(),
                host_connection_id: uuid(),
                started_at: moment().format(RFC3339),
                connected: true,
            }
            const session_list = List<Session>([session])
            const component = render(
                <Monitor factory={mockConnectionFactory} session_list={session_list} />
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
