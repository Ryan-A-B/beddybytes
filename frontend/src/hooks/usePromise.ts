import React from 'react';

interface StatePending {
    state: 'pending'
}

interface StateResolved<T> {
    state: 'resolved'
    value: T
}

interface StateRejected {
    state: 'rejected'
    error: Error
}

type State<T> = StatePending | StateResolved<T> | StateRejected

const InitialState: State<any> = {
    state: 'pending'
}

interface ActionResolve<T> {
    type: 'resolve'
    value: T
}

interface ActionReject {
    type: 'reject'
    error: Error
}

type Action<T> = ActionResolve<T> | ActionReject

const reducer = <T>(state: State<T>, action: Action<T>): State<T> => {
    switch (action.type) {
        case 'resolve':
            return {
                state: 'resolved',
                value: action.value
            }
        case 'reject':
            return {
                state: 'rejected',
                error: action.error
            }
    }
}

const usePromise = <T>(promise: Promise<T>): State<T> => {
    const [state, dispatch] = React.useReducer(reducer, InitialState)

    React.useEffect(() => {
        promise
            .then(value => {
                dispatch({
                    type: 'resolve',
                    value
                })
            })
            .catch(error => {
                dispatch({
                    type: 'reject',
                    error
                })
            })
    }, [promise])

    return state as State<T>
}

export default usePromise;