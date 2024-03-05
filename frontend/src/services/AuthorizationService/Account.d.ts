interface TrialSubscription {
    state: "trial"
    trial: {
        expiry: string
    }
}

interface ActiveSubscription {
    state: "active"
    active: {
        management_url: string
        expiry: string
    }
}

interface CanceledSubscription {
    state: "canceled"
    canceled: {
        expiry: string
    }
}

type Subscription = TrialSubscription | ActiveSubscription | CanceledSubscription

interface User {
    id: string
    email: string
    password_salt: string
    password_hash: string
}

interface Account {
    id: string
    subscription: Subscription
    user: User
}