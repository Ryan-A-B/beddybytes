import numeral from 'numeral'
import { DiscountFormat } from './types'

export const DefaultCouponCode = 'LAUNCHSALE'
export const DefaultDiscount = numeral(0.7).format(DiscountFormat)