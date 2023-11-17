import React from "react";
import useAccountStatus from "../../hooks/useAccountStatus";

const Account: React.FunctionComponent = () => {
    const account_status = useAccountStatus();
    if (account_status.status === 'no_account') return (
        <div>
            You are not logged in.
        </div>
    )
    return (
        <div className="row">
            <div className="col-xl-5 col-lg-6 col-md-8 mx-auto">
                <div className="card">
                    <h1 className="card-header">Account</h1>
                    <div className="card-body">
                        <h2>Subscription</h2>
                        <p className="text-capitalize">State: {account_status.account.subscription.state}</p>
                        {account_status.account.subscription.state === "active" && (
                            <a href={account_status.account.subscription.active.management_url} target="_blank" rel="noreferrer" className="btn btn-info w-100">
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
