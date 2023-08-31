export interface PromiseStatePending {
    state: 'pending'
}

export interface PromiseStateFulfilled<T> {
    state: 'fulfilled'
    value: T
}

export interface PromiseStateRejected {
    state: 'rejected'
    error: Error
}

export type PromiseState<T> = PromiseStatePending | PromiseStateFulfilled<T> | PromiseStateRejected;

export const InitialPromiseState: PromiseStatePending = { state: 'pending' };