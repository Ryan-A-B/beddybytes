import React from 'react'
import numeral from 'numeral'

interface Props {
    price: number;
    discount: number;
    currency?: string;
}

const DefaultCurrency = "AUD";
const CurrencyFormat = "0,0.00";

const DiscountedPrice: React.FunctionComponent<Props> = ({ price, discount, currency = DefaultCurrency }) => {
    const discounted_price = price * (1 - discount);

    return (
        <span>
            <span className="text-decoration-line-through">${numeral(price).format(CurrencyFormat)}</span>
            &nbsp;
            <span className="fs-3 fw-bold">${numeral(discounted_price).format(CurrencyFormat)}</span>
            &nbsp;
            <span className="fs-6">{currency}</span>
        </span>
    )
}

export default DiscountedPrice
