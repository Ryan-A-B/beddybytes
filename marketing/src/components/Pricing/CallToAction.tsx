import React from "react";
import { trial_signup_url, trial_signup_label } from "../../services/trial";

const CallToAction: React.FunctionComponent = () => {
    return (
        <a
            href={trial_signup_url}
            className="btn btn-primary btn-lg trial-pricing__button"
        >
            {trial_signup_label}
        </a>
    );
};

export default CallToAction;
