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
                    <h5>Use Cases</h5>
                    <ul className="list-unstyled">
                        <li>
                            <Link to="/private-baby-monitor/">Private Baby Monitor</Link>
                        </li>
                        <li>
                            <Link to="/no-subscription-baby-monitor/">No Subscription Baby Monitor</Link>
                        </li>
                        <li>
                            <Link to="/baby-monitor-app-iphone-and-android/">iPhone and Android</Link>
                        </li>
                        <li>
                            <Link to="/how-to-turn-an-old-phone-into-a-baby-monitor/">Turn an Old Phone Into a Baby Monitor</Link>
                        </li>
                        <li>
                            <Link to="/radio-baby-monitor-vs-wifi-baby-monitor/">Radio vs Wi-Fi Baby Monitor</Link>
                        </li>
                    </ul>
                </div>
                <div className="col-6 col-lg-2">
                    <h5>Features</h5>
                    <ul className="list-unstyled">
                        <li>
                            <Link to="/features/video-baby-monitor">Video</Link>
                        </li>
                        <li>
                            <Link to="/features/baby-monitor-with-recording">Recording</Link>
                        </li>
                        <li>
                            <Link to="/features/camera-zoom">Camera Zoom</Link>
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
                            <a href="https://www.youtube.com/@BeddyBytes" target="_blank" rel="noopener noreferrer">YouTube</a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>
)

export default Footer;
