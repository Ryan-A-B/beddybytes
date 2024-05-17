import React from 'react'
import { Link } from 'gatsby'
import NavbarDropdown from './NavbarDropdown'

const ActiveButtonProps = {
    'aria-expanded': true,
}

const InactiveButtonProps = {
    'aria-expanded': false,
}

const getButtonProps = (isActive: boolean) => {
    return isActive ? ActiveButtonProps : InactiveButtonProps
}

const CollapseClassName = 'collapse navbar-collapse'
const ActiveCollapseClassName = `${CollapseClassName} show`

const getCollapseClassName = (isActive: boolean) => {
    return isActive ? ActiveCollapseClassName : CollapseClassName
}

const Navbar: React.FunctionComponent = () => {
    const [show, setShow] = React.useState<boolean>(false)
    const toggleShow = React.useCallback(
        () => setShow(!show),
        [show, setShow]
    )

    const navRef = React.useRef<HTMLDivElement>(null)

    React.useLayoutEffect(() => {
        const nav = navRef.current
        if (nav === null) return
        const hide = (event: MouseEvent) => {
            if (event.target === null) return
            const target = event.target as Node
            if (nav.contains(target)) return
            setShow(false)
        }
        window.addEventListener('click', hide)
        return () => window.removeEventListener('click', hide)
    }, [show, setShow])

    const onNavLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        setShow(false)
    }

    return (
        <nav className="navbar navbar-expand-lg" ref={navRef}>
            <div className="container">
                <Link className="navbar-brand" to="/">BeddyBytes</Link>
                <button
                    type="button"
                    className="navbar-toggler"
                    aria-controls="navbar-collapse"
                    aria-label="Toggle navigation"
                    onClick={toggleShow}
                    {...getButtonProps(show)}
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className={getCollapseClassName(show)} id="navbar-collapse">
                    <ul className="navbar-nav">
                        <NavbarDropdown buttonText="Features">
                                <li>
                                    <Link to="/features/recording" className="dropdown-item">
                                        Recording
                                    </Link>
                                </li>
                        </NavbarDropdown>
                        <li className="nav-item">
                            <Link to="/pricing" className="nav-link" onClick={onNavLinkClick}>
                                Pricing
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link to="/blog" className="nav-link" onClick={onNavLinkClick}>
                                Blog
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link to="/about" className="nav-link" onClick={onNavLinkClick}>
                                About
                            </Link>
                        </li>
                    </ul>
                </div>
                <div className="d-lg-flex collapse">
                    <Link to="/pricing" className="btn btn-primary">
                        Use baby monitor
                    </Link>
                </div>
            </div>
        </nav>
    )
}

export default Navbar