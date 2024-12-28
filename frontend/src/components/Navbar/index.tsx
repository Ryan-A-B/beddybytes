import React from "react";
import { Link } from "react-router-dom";
import NavLink from "./NavLink";

const Navbar: React.FunctionComponent = () => {
    const [show, setShow] = React.useState(false);
    const navbarTogglerClassName = `navbar-toggler ${show ? "collapsed" : ""}`
    const collapseClassName = `collapse navbar-collapse ${show ? "show" : ""}`
    const toggleShow = React.useCallback(
        () => setShow(!show),
        [show, setShow]
    );
    return (
        <nav className="navbar navbar-expand-md bg-body-tertiary">
            <div className="container">
                <Link to="/" className="navbar-brand">
                    BeddyBytes
                </Link>
                <button
                    type="button"
                    className={navbarTogglerClassName}
                    onClick={toggleShow}
                    aria-expanded={show ? "true" : "false"}
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className={collapseClassName} id="navbarSupportedContent">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        <li className="nav-item">
                            <NavLink id="nav-link-baby" to="/baby">
                                Baby Station
                            </NavLink>
                        </li>
                        <li className="nav-item">
                            <NavLink id="nav-link-parent" to="/parent">
                                Parent Station
                            </NavLink>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    )
}

export default Navbar;
