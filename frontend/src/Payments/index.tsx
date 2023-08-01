import React from 'react'
import moment from 'moment';
import settings from '../settings'
import authorization from '../authorization'
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

interface AccountAndPaymentLinkURL {
    account: Account
    paymentLinkURL: string | null
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

const getPaymentLinkURL = (accessToken: string): Promise<string | null> => {
    return fetch(`https://${settings.API.host}/accounts/current/payment_link_url`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
        }
    }).then((response): Promise<string | null> => {
        switch (response.status) {
            case 200:
                return response.json()
            case 204:
                return Promise.resolve(null)
            default:
                throw new Error(`Unexpected response status: ${response.status}`)
        }
    })
}

const getAccountAndPaymentLinkURL = async (): Promise<AccountAndPaymentLinkURL> => {
    const accessToken = await authorization.getAccessToken()
    const account = await getAccount(accessToken)
    if (account.subscription.state === "active")
        return { account, paymentLinkURL: null }
    const paymentLinkURL = await getPaymentLinkURL(accessToken)
    return { account, paymentLinkURL }
}

const useAccountAndPaymentLinkURL = () => {
    const promise = React.useMemo(() => {
        return getAccountAndPaymentLinkURL()
    }, [])
    return usePromise<AccountAndPaymentLinkURL>(promise);
}

const Payments: React.FunctionComponent = () => {
    const promise = useAccountAndPaymentLinkURL()
    if (promise.state !== "resolved")
        return null;
    if (promise.value.paymentLinkURL === null)
        return null;
    return (
        <div className="alert alert-info">
            {promise.value.account.subscription.state === "trial" && moment(promise.value.account.subscription.trial.expiry).isBefore(moment()) && (
                <React.Fragment>
                    Your trial has ended.&nbsp;
                    <a href={promise.value.paymentLinkURL} target="_blank">
                        Activate your account
                    </a>
                </React.Fragment>
            )}
            {promise.value.account.subscription.state === "trial" && moment(promise.value.account.subscription.trial.expiry).isAfter(moment()) && (
                <React.Fragment>
                    Your trial ends in {moment(promise.value.account.subscription.trial.expiry).fromNow()}.&nbsp;
                    <a href={promise.value.paymentLinkURL} target="_blank">
                        Activate your account
                    </a>
                </React.Fragment>
            )}
            {promise.value.account.subscription.state === "canceled" && moment(promise.value.account.subscription.canceled.expiry).isBefore(moment()) && (
                <React.Fragment>
                    Your subscription ended on {moment(promise.value.account.subscription.canceled.expiry).format("MMMM Do YYYY")}.&nbsp;
                    <a href={promise.value.paymentLinkURL} target="_blank">
                        Renew your subscription
                    </a>
                </React.Fragment>
            )}
            {promise.value.account.subscription.state === "canceled" && moment(promise.value.account.subscription.canceled.expiry).isAfter(moment()) && (
                <React.Fragment>
                    Your subscription will end on {moment(promise.value.account.subscription.canceled.expiry).format("MMMM Do YYYY")}.&nbsp;
                    <a href={promise.value.paymentLinkURL} target="_blank">
                        Renew your subscription
                    </a>
                </React.Fragment>
            )}
        </div>
    )
}

export default Payments