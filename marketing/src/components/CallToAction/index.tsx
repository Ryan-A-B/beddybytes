import React from 'react'
import { Link } from 'gatsby'
import numeral from 'numeral'
import useOnClick from '../../hooks/useOnClick'
import { DiscountFormat, To } from './types'
import promotion from '../../services/promotion'

interface Props {
    to: To
    color?: 'primary' | 'light'
    coupon_code: string
    discount: number
    click_id: string
}

const DefaultColor = 'primary'

const CallToAction: React.FunctionComponent<Props> = ({ to, color = DefaultColor, coupon_code = promotion.code, discount = promotion.discount, click_id }) => {
    const onClick = useOnClick(click_id)
    return (
        <div className={`call-to-action mt-3`}>
            <small>
                Use coupon code <code>{coupon_code}</code> for {numeral(discount).format(DiscountFormat)} off.
            </small>
            <br />
            <Link to={to} onClick={onClick} target="_blank" className={`btn btn-${color} btn-lg w-100`}>
                See pricing
            </Link>
        </div>
    )
}

export default CallToAction
