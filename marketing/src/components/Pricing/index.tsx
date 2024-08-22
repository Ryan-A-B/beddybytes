import React from "react";
import CallToAction from "./CallToAction";
import DiscountedPrice from "./DiscountedPrice";

import "./style.scss";

const PopularBadge: React.FunctionComponent = () => {
    return (
        <span className="badge text-bg-primary position-absolute top-0 start-50 translate-middle">
            Popular
        </span>
    )
}

const LaunchSaleBadge: React.FunctionComponent = () => {
    return (
        <span className="badge text-bg-success position-absolute top-0 end-0">
            Save 70%
            <br />
            Launch Sale Offer
        </span>
    )
}

const Pricing: React.FunctionComponent = () => (
    <div className="row justify-content-center">
        <div className="col-sm-auto my-3">
            <section className="card card-pricing">
                <LaunchSaleBadge />
                <div className="card-body">
                    <h3 className="card-title">1 year access</h3>
                    <h5 className="card-subtitle mb-3">
                        Get to know us
                    </h5>
                    <DiscountedPrice price={50} discount={0.7} />
                    <CallToAction product="one_year" />
                </div>
            </section>
        </div>
        <div className="col-sm-auto my-3">
            <section className="card card-pricing">
                <PopularBadge />
                <LaunchSaleBadge />
                <div className="card-body">
                    <h3 className="card-title">
                        Lifetime access
                    </h3>
                    <h5 className="card-subtitle mb-3">
                        Buy once, use forever
                    </h5>
                    <DiscountedPrice price={80} discount={0.7} />
                    <CallToAction product="lifetime" />
                </div>
            </section>
        </div>
    </div>
)

export default Pricing
