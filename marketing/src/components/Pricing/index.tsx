import React from "react";
import numeral from "numeral";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import CallToAction from "./CallToAction";
import DiscountedPrice from "./DiscountedPrice";
import { DiscountFormat } from "../CallToAction/types";
import promotion from "../../services/promotion";

import "./style.scss";
import { lifetime_price, one_year_price } from "../../services/price";

const PopularHeader: React.FunctionComponent = () => {
    return (
        <div className="pricing-card__header pricing-card__header--popular">
            <FontAwesomeIcon icon={faStar} />
            <span>Most popular</span>
        </div>
    )
}

const PromotionBadge: React.FunctionComponent = () => {
    return (
        <span className="pricing-discount">
            Save {numeral(promotion.discount).format(DiscountFormat)} · code {promotion.code}
        </span>
    )
}

const Pricing: React.FunctionComponent = () => (
    <div className="d-flex flex-wrap justify-content-center">
        <section className="card card-pricing border-primary-subtle flex-fill order-lg-2">
            <PopularHeader />
            <div className="card-body">
                <h2 className="card-title">
                    Lifetime one-time purchase
                </h2>
                <div className="text-center">
                    <DiscountedPrice price={lifetime_price} discount={promotion.discount} />
                    <div><PromotionBadge /></div>
                </div>
                <p className="text-center text-muted">
                    Best value for families who want a private baby monitor app
                    with no recurring fees.
                </p>
                <CallToAction product="lifetime" coupon_code={promotion.code} show_coupon_message={false} />
            </div>
        </section>
        <section className="card card-pricing border-primary-subtle flex-fill">
            <div className="pricing-card__header pricing-card__header--placeholder" aria-hidden="true" />
            <div className="card-body">
                <h2 className="card-title">1-year one-time purchase</h2>
                <div className="text-center">
                    <DiscountedPrice price={one_year_price} discount={promotion.discount} />
                    <div><PromotionBadge /></div>
                </div>
                <p className="text-center text-muted">
                    Lower upfront cost to try BeddyBytes with no subscription.
                </p>
                <CallToAction product="one_year" coupon_code={promotion.code} show_coupon_message={false} />
            </div>
        </section>
    </div>
)

export default Pricing
