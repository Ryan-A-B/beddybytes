import { render, fireEvent } from '@testing-library/react';
import { v4 as uuid } from 'uuid';

import SessionsDropdown from './SessionDropdown';
import SessionsMock from './SessionsMock';
import { Session } from './Sessions';
import { act } from 'react-dom/test-utils';

describe('SessionsDropdown', () => {
    it('should render correctly when there are no sessions', async () => {
        const mock = new SessionsMock();
        let value: Session | null = null;
        const onChange = jest.fn((session: Session | null) => { value = session })
        const component = render(
            <SessionsDropdown
                sessions={mock}
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
        const mock = new SessionsMock();
        const clientID = uuid();
        const sessionName = uuid();
        mock.start({
            host_connection_id: clientID,
            session_name: sessionName,
        });
        let value: Session | null = null;
        const onChange = jest.fn((session: Session | null) => { value = session })
        const component = render(
            <SessionsDropdown
                sessions={mock}
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
        expect(options[1].textContent).toEqual(sessionName);
        expect(onChange).toHaveBeenCalledTimes(0);
        expect(value).toEqual(null);
    });

    it('should rerender when sessions change', async () => {
        const mock = new SessionsMock();
        let value: Session | null = null;
        const onChange = jest.fn((session: Session | null) => { value = session })
        const component = render(
            <SessionsDropdown
                sessions={mock}
                value={value}
                onChange={onChange}
            />
        );

        await act(async () => { });

        const body = component.baseElement;
        {
            const div = body.querySelector(`div`);
            if (div === null) throw new Error(`div not found`);
            expect(div.textContent).toEqual('No sessions found');
            expect(onChange).toHaveBeenCalledTimes(0);
            expect(value).toEqual(null);
        }

        const clientID = uuid();
        const sessionName = uuid();
        let session: Session | null = null
        await act(async () => {
            session = await mock.start({
                host_connection_id: clientID,
                session_name: sessionName,
            });
        });

        if (session === null) throw new Error(`session not found`);
        {
            const select = body.querySelector(`select`);
            if (select === null) throw new Error(`select not found`);
            const options = select.querySelectorAll(`option`);
            expect(options.length).toEqual(2);
            expect(options[0].textContent).toEqual('Select a session');
            expect(options[1].textContent).toEqual(sessionName);
            expect(onChange).toHaveBeenCalledTimes(0);
            expect(value).toEqual(null);
        }

        act(() => {
            if (session === null) throw new Error(`session not found`);
            mock.end({
                session_id: session.id,
            });
        });
        {
            const div = body.querySelector(`div`);
            if (div === null) throw new Error(`div not found`);
            expect(div.textContent).toEqual('No sessions found');
            expect(onChange).toHaveBeenCalledTimes(0);
            expect(value).toEqual(null);
        }

        // TODO if value is set and the session is ended, the value should be set to null?
    });

    it('should call onChange when a session is selected', async () => {
        const mock = new SessionsMock();
        const clientID = uuid();
        const sessionName = 'Session 1';
        const expectedSession = await mock.start({
            host_connection_id: clientID,
            session_name: sessionName,
        });
        let value: Session | null = null;
        const onChange = jest.fn((session: Session | null) => { value = session })
        const component = render(
            <SessionsDropdown
                sessions={mock}
                value={value}
                onChange={onChange}
            />
        );

        await act(async () => { });

        const body = component.baseElement;
        const select = body.querySelector(`select`);
        if (select === null) throw new Error(`select not found`);
        fireEvent.change(select, { target: { value: expectedSession.id } });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(value).toEqual(expectedSession);

        fireEvent.change(select, { target: { value: '' } });
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(value).toEqual(null);
    });
});
