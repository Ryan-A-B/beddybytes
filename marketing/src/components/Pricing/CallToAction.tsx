import React from "react"
import useOnClick from '../../hooks/useOnClick'
import { CouponCode } from "../CallToAction/types"
import { DefaultCouponCode, DefaultDiscount } from "../CallToAction/defaults"

const payment_links = {
    "lifetime": "https://buy.stripe.com/bIY3fh6os9dp68o9AC",
    "one_year": "https://buy.stripe.com/bIY8zBbIM89lbsI9AD",
}

interface Props {
    product: keyof typeof payment_links
    coupon_code?: CouponCode
    discount?: string
}

const CallToAction: React.FunctionComponent<Props> = ({ product, coupon_code = DefaultCouponCode, discount = DefaultDiscount }) => {
    const onClick = useOnClick(`purchase-${product}`)
    const payment_link = `${payment_links[product]}?prefilled_promo_code=${coupon_code}`
    return (
        <div className={`call-to-action mt-3`}>
            <small>
                Use coupon code <code>{coupon_code}</code> for {discount} off.
            </small>
            <br />
            <a
                href={payment_link}
                onClick={onClick}
                target="_blank"
                rel="external"
                className="btn btn-primary btn-lg w-100"
            >
                Buy now
            </a>
        </div>
    )
}

export default CallToAction