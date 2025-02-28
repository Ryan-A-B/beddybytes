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
        <div className="col-sm-auto my-3">
            <section className="card card-pricing">
                <PromotionBadge />
                <div className="card-body">
                    <h3 className="card-title">1 year access</h3>
                    <h5 className="card-subtitle mb-3">
                        Get to know us
                    </h5>
                    <DiscountedPrice price={one_year_price} discount={promotion.discount} />
                    <ul>
                        <li>
                            One account
                            <ul>
                                <li>unlimited baby/parent stations</li>
                                <li>bring your own devices</li>
                            </ul>
                        </li>
                        <li>30 day trial</li>
                    </ul>
                    <CallToAction product="one_year" coupon_code={promotion.code} discount={promotion.discount} />
                </div>
            </section>
        </div>
        <div className="col-sm-auto my-3">
            <section className="card card-pricing">
                <PopularBadge />
                <PromotionBadge />
                <div className="card-body">
                    <h3 className="card-title">
                        Lifetime access
                    </h3>
                    <h5 className="card-subtitle mb-3">
                        Buy once, use forever
                    </h5>
                    <DiscountedPrice price={lifetime_price} discount={promotion.discount} />
                    <ul>
                        <li>
                            One account
                            <ul>
                                <li>unlimited baby/parent stations</li>
                                <li>bring your own devices</li>
                            </ul>
                        </li>
                        <li>30 day trial</li>
                    </ul>
                    <CallToAction product="lifetime" coupon_code={promotion.code} discount={promotion.discount}/>
                </div>
            </section>
        </div>
    </div>
)

export default Pricing
