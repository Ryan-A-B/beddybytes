import moment from 'moment';
import { v4 as uuid } from 'uuid';
import settings from '../settings';
import { EndSessionInput, Session, SessionsWriter, StartSessionInput } from './Sessions';
import authorization_service from '../instances/authorization_service';

const RFC3339 = 'YYYY-MM-DDTHH:mm:ssZ';

const isClientError = (code: number): boolean => (code >= 400 && code < 500);

const sleep = (duration: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    });
}

const startSession = async (session: Session): Promise<void> => {
    const access_token = await authorization_service.get_access_token();
    const response = await fetch(`https://${settings.API.host}/sessions/${session.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${access_token}` },
        body: JSON.stringify(session),
    })
    if (response.ok) return;
    const payload = await response.text()
    if (isClientError(response.status))
        throw new Error(`Failed to start session: ${payload}`);
    console.error(`Failed to start session: ${payload}`)
    await sleep(5000)
    return startSession(session)
}

const endSession = async (sessionID: string): Promise<void> => {
    const access_token = await authorization_service.get_access_token();
    const response = await fetch(`https://${settings.API.host}/sessions/${sessionID}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${access_token}` },
    })
    if (response.ok) return;
    const payload = await response.text()
    if (isClientError(response.status))
        throw new Error(`Failed to end session: ${payload}`);
    console.error(`Failed to end session: ${payload}`)
    await sleep(5000)
    return endSession(sessionID)
}

class SessionsWriterAPI implements SessionsWriter {
    start = async (input: StartSessionInput): Promise<Session> => {
        const now = moment();
        const session: Session = {
            id: uuid(),
            name: input.session_name,
            host_connection_id: input.host_connection_id,
            started_at: now.format(RFC3339),
        };
        await startSession(session)
        return session;
    }

    end = async (input: EndSessionInput): Promise<void> => {
        await endSession(input.session_id)
    }
}

export default SessionsWriterAPI;
