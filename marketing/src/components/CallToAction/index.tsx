import React from 'react'
import { Link } from 'gatsby'
import useOnClick from '../../hooks/useOnClick'
import { DefaultCouponCode, DefaultDiscount } from './defaults'
import { CouponCode, To } from './types'

interface Props {
    to: To
    color?: 'primary' | 'light'
    coupon_code?: CouponCode
    discount?: string
    click_id: string
}

const DefaultColor = 'primary'

const CallToAction: React.FunctionComponent<Props> = ({ to, color = DefaultColor, coupon_code = DefaultCouponCode, discount = DefaultDiscount, click_id }) => {
    const onClick = useOnClick(click_id)
    return (
        <div className={`call-to-action mt-3`}>
            <small>
                Use coupon code <code>{coupon_code}</code> for {discount} off.
            </small>
            <br />
            <Link to={to} onClick={onClick} target="_blank" className={`btn btn-${color} btn-lg w-100`}>
                Use baby monitor
            </Link>
        </div>
    )
}

export default CallToAction