import React from "react";
import { Link, LinkProps, useLocation } from "react-router-dom";

const NavLink: React.FunctionComponent<LinkProps> = ({ to, ...props }) => {
    const location = useLocation();
    const className = React.useMemo(() => {
        if (to === location.pathname) return "nav-link active";
        return "nav-link";
    }, [to, location.pathname])
    return (
        <Link to={to} className={className} {...props} />
    )
}

export default NavLink;
