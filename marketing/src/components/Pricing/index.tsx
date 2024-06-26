import React from "react";
import PurchaseOneYearAccessCallToAction from "../CallToAction/PurchaseOneYearAccessCallToAction";
import PurchaseLifetimeAccessCallToAction from "../CallToAction/PurchaseLifetimeAccessCallToAction";
import DiscountedPrice from "./DiscountedPrice";

import "./style.scss"

const PopularBadge: React.FunctionComponent = () => {
    return (
        <span className="badge text-bg-primary position-absolute top-0 start-50 translate-middle">
            Popular
        </span>
    )
}

const EarlyAccessBadge: React.FunctionComponent = () => {
    return (
        <span className="badge text-bg-success position-absolute top-0 end-0">
            Save 70%
            <br />
            Early Access Offer
        </span>
    )
}

const Pricing: React.FunctionComponent = () => (
    <div className="row justify-content-center">
        <div className="col-sm-auto my-3">
            <section className="card card-pricing">
                <EarlyAccessBadge />
                <div className="card-body">
                    <h3 className="card-title">1 year access</h3>
                    <h5 className="card-subtitle mb-3">
                        Get to know us
                    </h5>
                    <DiscountedPrice price={50} discount={0.7} />
                    <PurchaseOneYearAccessCallToAction />
                </div>
            </section>
        </div>
        <div className="col-sm-auto my-3">
            <section className="card card-pricing">
                <PopularBadge />
                <EarlyAccessBadge />
                <div className="card-body">
                    <h3 className="card-title">
                        Lifetime access
                    </h3>
                    <h5 className="card-subtitle mb-3">
                        Buy once, use forever
                    </h5>
                    <DiscountedPrice price={80} discount={0.7} />
                    <PurchaseLifetimeAccessCallToAction />
                </div>
            </section>
        </div>
    </div>
)

export default Pricing
