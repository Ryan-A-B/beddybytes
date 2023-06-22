import React from "react";
import { Link } from "react-router-dom";
import NavLink from "./NavLink";

const Navbar: React.FunctionComponent = () => {
    return (
        <nav className="navbar navbar-expand bg-body-tertiary mb-3">
            <div className="container">
                <Link to="/" className="navbar-brand">
                    Baby Monitor<sup>BETA</sup>
                </Link>
                <div className="collapse navbar-collapse" id="navbarSupportedContent">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        <li className="nav-item">
                            <NavLink to="/monitor">
                                Monitor
                            </NavLink>
                        </li>
                        <li className="nav-item">
                            <NavLink to="/camera">
                                Camera
                            </NavLink>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    )
}

export default Navbar;
