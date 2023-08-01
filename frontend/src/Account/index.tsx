import React from "react";
import settings from "../settings";
import authorization from '../authorization';
import usePromise from '../hooks/usePromise';

interface Account {
    id: string
    subscription: Subscription
    user: User
}

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

const getAccount = (accessToken: string): Promise<Account> => {
    return fetch(`https://${settings.API.host}/accounts/current`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
        }
    }).then((response): Promise<Account> => {
        switch (response.status) {
            case 200:
                return response.json()
            default:
                throw new Error(`Unexpected response status: ${response.status}`)
        }
    })
}

const useAccount = () => {
    const promise = React.useMemo(async () => {
        const accessToken = await authorization.getAccessToken()
        return await getAccount(accessToken)
    }, [])
    return usePromise<Account>(promise);
}

const Account: React.FunctionComponent = () => {
    const accountPromise = useAccount()
    if (accountPromise.state === "pending") return <div>Loading...</div>
    if (accountPromise.state === "rejected") return <div>Error: {accountPromise.error.message}</div>
    return (
        <div className="row">
            <div className="col-xl-5 col-lg-6 col-md-8 mx-auto">
                <div className="card">
                    <h1 className="card-header">Account</h1>
                    <div className="card-body">
                        <h2>Subscription</h2>
                        <p className="text-capitalize">State: {accountPromise.value.subscription.state}</p>
                        {accountPromise.value.subscription.state === "active" && (
                            <a href={accountPromise.value.subscription.active.management_url} target="_blank" className="btn btn-info w-100">
                                Manage
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Account;
