import React from 'react';
import CallToAction from '../CallToAction';
import { To } from '../CallToAction/types';
import promotion from '../../services/promotion';

interface Props {
    to: To
}

const CallToActionSection: React.FunctionComponent<Props> = ({ to }) => (
    <section className="bg-primary text-light py-5">
        <div className="container text-center">
            <h2>Get started today</h2>
            <CallToAction
                to={to}
                color="light"
                click_id="cta-cta-section"
                coupon_code={promotion.code}
                discount={promotion.discount}
            />
        </div>
    </section>
)

export default CallToActionSection;
