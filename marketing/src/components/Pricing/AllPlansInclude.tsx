import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBaby, faLink, faMobileScreenButton, faRotate, faTags, faVideo } from '@fortawesome/free-solid-svg-icons';
import { TrialPeriod } from './Messages';

const AllPlansInclude: React.FunctionComponent = () => {
    return (
        <section id="all-plans-include" className="alert alert-light text-center mx-auto border-0">
            <h2>Every one-time purchase plan includes</h2>
            <ul className="d-flex flex-wrap justify-content-around list-unstyled">
                <li><FontAwesomeIcon icon={faMobileScreenButton} /> Use your own devices</li>
                <li><FontAwesomeIcon icon={faVideo} /> Local-only streaming</li>
                <li><FontAwesomeIcon icon={faBaby} /> Unlimited baby stations</li>
                <li><FontAwesomeIcon icon={faLink} /> Unlimited parent stations</li>
                <li><FontAwesomeIcon icon={faTags} /> No subscription</li>
                <li><FontAwesomeIcon icon={faRotate} /> All future updates</li>
            </ul>
            <TrialPeriod />
        </section>
    );
}

export default AllPlansInclude;
