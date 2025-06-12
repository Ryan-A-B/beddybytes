import React from "react";
import numeral from "numeral";
import CallToAction from "./CallToAction";
import DiscountedPrice from "./DiscountedPrice";
import { DiscountFormat } from "../CallToAction/types";
import promotion from "../../services/promotion";

import "./style.scss";
import { lifetime_price, one_year_price } from "../../services/price";

const PopularBadge: React.FunctionComponent = () => {
    return (
        <span className="badge text-bg-primary position-absolute top-0 start-50 translate-middle">
            Popular
        </span>
    )
}

const PromotionBadge: React.FunctionComponent = () => {
    return (
        <span className="badge text-bg-success position-absolute top-0 end-0">
            Save {numeral(promotion.discount).format(DiscountFormat)}
            <br />
            with code {promotion.code}
        </span>
    )
}

const Pricing: React.FunctionComponent = () => (
    <div className="row justify-content-center">
        <div className="col-sm-auto mb-3">
            <section className="card card-pricing">
                <PromotionBadge />
                <div className="card-body">
                    <h3 className="card-title">1 year access</h3>
                    <div className="text-center">
                        <DiscountedPrice price={one_year_price} discount={promotion.discount} />
                    </div>
                    <p className="text-center text-muted">
                        Ideal for trying us out and covering baby's first year.
                    </p>
                    <CallToAction product="one_year" coupon_code={promotion.code} discount={promotion.discount} />
                </div>
            </section>
        </div>
        <div className="col-sm-auto mb-3">
            <section className="card card-pricing">
                <PopularBadge />
                <PromotionBadge />
                <div className="card-body">
                    <h3 className="card-title">
                        Lifetime access
                    </h3>
                    <div className="text-center">
                        <DiscountedPrice price={lifetime_price} discount={promotion.discount} />
                    </div>
                    <p className="text-center text-muted">
                        Perfect for long term peace of mind with no recurring fees.
                    </p>
                    <CallToAction product="lifetime" coupon_code={promotion.code} discount={promotion.discount} />
                </div>
            </section>
        </div>
    </div>
)

export default Pricing
