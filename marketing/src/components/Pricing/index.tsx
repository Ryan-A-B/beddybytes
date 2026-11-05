import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import { lifetime_price } from "../../services/price";
import CallToAction from "./CallToAction";

import "./style.scss";

interface Props {
    heading?: "h1" | "h2";
}

const Pricing: React.FunctionComponent<Props> = ({ heading: Heading = "h2" }) => (
    <div className="trial-pricing">
        <div className="trial-pricing__offer">
            <Heading className="trial-pricing__heading">
                Lifetime access,<br />
                no subscription
            </Heading>
            <p className="trial-pricing__price">
                <span>${lifetime_price}</span> <span className="trial-pricing__currency">USD</span>
            </p>
        </div>
        <div className="trial-pricing__action">
            <p className="trial-pricing__trust">
                <FontAwesomeIcon icon={faClock} aria-hidden="true" />
                <span>Over 25,000 hours</span>
            </p>
            <CallToAction />
            <p className="trial-pricing__reassurance">No credit card required</p>
        </div>
    </div>
);

export default Pricing;
