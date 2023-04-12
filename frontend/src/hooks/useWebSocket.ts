import React from "react";

interface StateOpen {
    state: 'open'
    websocket: WebSocket
}

interface StateClosed {
    state: 'closed'
}

type State = StateOpen | StateClosed
const InitialState: State = {
    state: 'closed'
}

interface ActionOpened {
    type: 'opened'
    websocket: WebSocket
}

interface ActionClose {
    type: 'closed'
}

type Action = ActionOpened | ActionClose

const reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case 'opened':
            return {
                state: 'open',
                websocket: action.websocket
            }
        case 'closed':
            return {
                state: 'closed'
            }
    }
}

const useWebSocket = (url: string) => {
    const [state, dispatch] = React.useReducer(reducer, InitialState)

    React.useEffect(() => {
        const websocket = new WebSocket(url)
        websocket.onopen = () => {
            dispatch({
                type: 'opened',
                websocket
            })
        }
        websocket.onclose = () => {
            dispatch({
                type: 'closed'
            })
        }
    }, [url])

    return state
}

export default useWebSocket;