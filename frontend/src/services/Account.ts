export interface TrialSubscription {
    state: "trial"
    trial: {
        expiry: string
    }
}

export interface ActiveSubscription {
    state: "active"
    active: {
        management_url: string
        expiry: string
    }
}

export interface CanceledSubscription {
    state: "canceled"
    canceled: {
        expiry: string
    }
}

export type Subscription = TrialSubscription | ActiveSubscription | CanceledSubscription

export interface User {
    id: string
    email: string
    password_salt: string
    password_hash: string
}

export interface Account {
    id: string
    subscription: Subscription
    user: User
}