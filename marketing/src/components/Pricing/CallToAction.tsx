import React from "react"
import useOnClick from '../../hooks/useOnClick'
import { CouponCode } from "../CallToAction/types"
import { DefaultCouponCode, DefaultDiscount } from "../CallToAction/defaults"

const square_link = {
    "lifetime": "https://square.link/u/7hK0Ut9W",
    "one_year": "https://square.link/u/qz0OYi34",
}

interface Props {
    product: keyof typeof square_link
    coupon_code?: CouponCode
    discount?: string
}

const CallToAction: React.FunctionComponent<Props> = ({ product, coupon_code = DefaultCouponCode, discount = DefaultDiscount }) => {
    const onClick = useOnClick(`purchase-${product}`)
    const external_link = square_link[product]
    return (
        <div className={`call-to-action mt-3`}>
            <small>
                Use coupon code <code>{coupon_code}</code> for {discount} off.
            </small>
            <br />
            <a href={external_link} onClick={onClick} target="_blank" className="btn btn-primary btn-lg w-100">
                Use baby monitor
            </a>
        </div>
    )
}

export default CallToAction