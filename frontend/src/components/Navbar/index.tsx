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
    const navElementRef = React.useRef<HTMLElement>(null);
    React.useLayoutEffect(() => {
        const navElement = navElementRef.current;
        if (navElement === null) return;
        const hide = (event: MouseEvent) => {
            if (event.target === null) return;
            const target = event.target as Node;
            if (navElement.contains(target)) return;
            setShow(false);
        };
        window.addEventListener('click', hide);
        return () => window.removeEventListener('click', hide);
    }, [show, setShow]);
    const onNavLinkClick = React.useCallback(() => {
        setShow(false);
    }, [setShow]);
    return (
        <nav className="navbar navbar-expand-md bg-body-tertiary" ref={navElementRef}>
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
                            <NavLink id="nav-link-baby" to="/baby" onClick={onNavLinkClick}>
                                Baby Station
                            </NavLink>
                        </li>
                        <li className="nav-item">
                            <NavLink id="nav-link-parent" to="/parent" onClick={onNavLinkClick}>
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
