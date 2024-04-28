import React from 'react';
import Nanit from './Nanit';
import Cubo from './Cubo';

import './style.scss';

const InactiveIndicatorProps = {
    'data-bs-target': 'x',
};
const ActiveIndicatorProps = {
    'aria-current': true,
    'className': 'active',
    'data-bs-target': 'x',
};

const getIndicatorProps = (isActive: boolean) => isActive ? ActiveIndicatorProps : InactiveIndicatorProps;

const ItemClass = 'carousel-item';
const ActiveItemClass = `${ItemClass} active`;

const getCaroselItemClass = (isActive: boolean) => isActive ? ActiveItemClass : ItemClass;

const PrivacyPolicySnippets: React.FunctionComponent = () => {
    const [active, setActive] = React.useState(0);
    const onClick = (index: number) => React.useCallback(() => setActive(index), [index]);

    return (
        <section className="privacy-policy-snippets card text-bg-dark">
            <div className="card-header">
                <h3 className="card-title">Snippets of privacy policies from other baby monitor providers</h3>
            </div>
            <div className="card-body">
                <div className="carousel carousel-dark">
                    <div className="carousel-indicators">
                        <button
                            type="button"
                            aria-label="Snippet 1"
                            onClick={onClick(0)}
                            {...getIndicatorProps(active === 0)}
                        ></button>
                        <button
                            type="button"
                            aria-label="Snippet 2"
                            onClick={onClick(1)}
                            {...getIndicatorProps(active === 1)}
                        ></button>
                    </div>
                    <div className="carousel-inner">
                        <div className={getCaroselItemClass(active === 0)}>
                            <Nanit />
                        </div>
                        <div className={getCaroselItemClass(active === 1)}>
                            <Cubo />
                        </div>
                    </div>
                </div>
            </div>
        </section >
    )
}

export default PrivacyPolicySnippets;
