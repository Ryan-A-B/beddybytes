import React from 'react';
import { build_timestamp, build_hash } from './build_info';

const Footer: React.FunctionComponent = () => (
    <footer>
        <div className="container">
            <div className="row justify-content-between">
                <div className="col-lg-3">
                    <span className="text-body-emphasis text-decoration-none fs-5">BeddyBytes</span>
                    <p className="small">
                        Designed and built with love by parents, for parents.
                    </p>
                </div>
                <div className="col-lg-2">
                    <h5>Build</h5>
                    <ul className="list-unstyled">
                        <li title={build_timestamp} className="text-truncate">
                            Date: {build_timestamp}
                        </li>
                        <li title={build_hash} className="text-truncate">
                            Hash: {build_hash}
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>
)

export default Footer;