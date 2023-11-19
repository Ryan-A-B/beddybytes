import { render, fireEvent } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { List } from 'immutable';
import { v4 as uuid } from 'uuid';
import moment from 'moment';

import SessionsDropdown from '.';
import { Session } from '../../services/SessionListService';

describe('SessionsDropdown', () => {
    it('should render correctly when there are no sessions', async () => {
        const session_list = List<Session>()
        let value: Session | null = null;
        const onChange = jest.fn((session: Session | null) => { value = session })
        const component = render(
            <SessionsDropdown
                session_list={session_list}
                value={value}
                onChange={onChange}
            />
        );

        await act(async () => { });

        const body = component.baseElement;
        const div = body.querySelector(`div`);
        if (div === null) throw new Error(`div not found`);
        expect(div.textContent).toEqual('No sessions found');
        expect(onChange).toHaveBeenCalledTimes(0);
        expect(value).toEqual(null);
    });

    it('should render correctly when there are sessions', async () => {
        const session: Session = {
            id: uuid(),
            name: uuid(),
            host_connection_id: uuid(),
            started_at: moment(),
            host_connection_state: {
                state: 'connected',
                since: moment(),
            },
        }
        const session_list = List<Session>([session])
        let value: Session | null = null;
        const onChange = jest.fn((session: Session | null) => { value = session })
        const component = render(
            <SessionsDropdown
                session_list={session_list}
                value={value}
                onChange={onChange}
            />
        );

        await act(async () => { });

        const body = component.baseElement;
        const select = body.querySelector(`select`);
        if (select === null) throw new Error(`select not found`);
        const options = select.querySelectorAll(`option`);
        expect(options.length).toEqual(2);
        expect(options[0].textContent).toEqual('Select a session');
        expect(options[1].textContent).toEqual(session.name);
        expect(onChange).toHaveBeenCalledTimes(0);
        expect(value).toEqual(null);
    });

    it('should call onChange when a session is selected', async () => {
        const session: Session = {
            id: uuid(),
            name: uuid(),
            host_connection_id: uuid(),
            started_at: moment(),
            host_connection_state: {
                state: 'connected',
                since: moment(),
            },
        }
        const session_list = List<Session>([session])
        let value: Session | null = null;
        const onChange = jest.fn((session: Session | null) => { value = session })
        const component = render(
            <SessionsDropdown
                session_list={session_list}
                value={value}
                onChange={onChange}
            />
        );

        await act(async () => { });

        const body = component.baseElement;
        const select = body.querySelector(`select`);
        if (select === null) throw new Error(`select not found`);
        fireEvent.change(select, { target: { value: session.id } });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(value).toEqual(session);

        fireEvent.change(select, { target: { value: '' } });
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(value).toEqual(null);
    });
});
