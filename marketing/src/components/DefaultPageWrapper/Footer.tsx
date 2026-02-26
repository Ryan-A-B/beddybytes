import React from 'react';
import { Link } from 'gatsby';

const Footer: React.FunctionComponent = () => (
    <footer className="wrapper-footer bg-body-tertiary py-5">
        <div className="container">
            <div className="row">
                <div className="col-lg-3">
                    <Link to="/" className="text-body-emphasis text-decoration-none fs-5">BeddyBytes</Link>
                    <p className="small">
                        Designed and built with love by parents, for parents.
                    </p>
                </div>
                <div className="col-6 col-lg-2">
                    <h5>Features</h5>
                    <ul className="list-unstyled">
                        <li>
                            <Link to="/features/baby-monitor-with-recording">Recording</Link>
                        </li>
                    </ul>
                </div>
                <div className="col-6 col-lg-2">
                    <h5>About</h5>
                    <ul className="list-unstyled">
                        <li>
                            <Link to="/pricing">Pricing</Link>
                        </li>
                        <li>
                            <Link to="/about">Creators</Link>
                        </li>
                        <li>
                            <Link to="/privacy-policy">Privacy Policy</Link>
                        </li>
                    </ul>
                </div>
                <div className="col-6 col-lg-2">
                    <h5>Socials</h5>
                    <ul className="list-unstyled">
                        <li>
                            <Link to="https://www.youtube.com/@BeddyBytes" target="_blank">YouTube</Link>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>
)

export default Footer;
