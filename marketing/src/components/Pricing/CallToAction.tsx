import React from "react";
import useOnClick from "../../hooks/useOnClick";

const CallToAction: React.FunctionComponent = () => {
    const onClick = useOnClick("trial-signup-pricing");

    return (
        <a
            href="https://app.beddybytes.com/#create_account"
            onClick={onClick}
            className="btn btn-primary btn-lg trial-pricing__button"
        >
            Start your 7 day free trial
        </a>
    );
};

export default CallToAction;
