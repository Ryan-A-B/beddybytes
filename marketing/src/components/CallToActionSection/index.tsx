import React from 'react';
import CallToAction from '../CallToAction';
import { To } from '../CallToAction/types';
import promotion from '../../services/promotion';

interface Props {
    to: To
    className?: string
    label?: string
}

const CallToActionSection: React.FunctionComponent<Props> = ({ to, className, label }) => (
    <section className={`bg-primary text-light ${className ?? 'py-5'}`}>
        <div className="container text-center">
            <h2>Get started today</h2>
            <CallToAction
                to={to}
                color="light"
                click_id="cta-cta-section"
                coupon_code={promotion.code}
                discount={promotion.discount}
                label={label}
            />
        </div>
    </section>
)

export default CallToActionSection;
