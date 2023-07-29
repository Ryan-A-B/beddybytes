import React from 'react'
import settings from '../settings'
import authorization from '../authorization'
import usePromise from '../hooks/usePromise';

const usePaymentLinkURL = () => {
    const promise = React.useMemo(() => {
        return authorization.getAccessToken().then((accessToken) => (
            fetch(`https://${settings.API.host}/payment_link_url`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                }
            }).then((response) => {
                switch (response.status) {
                    case 200:
                        return response.json()
                    case 204:
                        return null
                    default:
                        throw new Error(`Unexpected response status: ${response.status}`)
                }
            })
        ))
    }, []);
    return usePromise<string>(promise);
}

const Payments: React.FunctionComponent = () => {
    const paymentLinkURL = usePaymentLinkURL()
    if (paymentLinkURL.state !== "resolved")
        return null;
    if (paymentLinkURL.value === null)
        return null;
    // TODO "Your trial ends in x days, click here to activate your account"
    return (
        <div className="alert alert-info">
            <a href={paymentLinkURL.value} target="_blank">
                Activate your account
            </a>
        </div>
    )
}

export default Payments