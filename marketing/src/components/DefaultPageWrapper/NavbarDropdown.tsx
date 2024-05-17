import React from 'react'

interface Props {
    buttonText: string
    children: React.ReactNode
}

const DropdownMenuClassName = 'dropdown-menu'
const ActiveDropdownMenuClassName = `${DropdownMenuClassName} show`

const getDropdownMenuClassName = (isActive: boolean) => {
    return isActive ? ActiveDropdownMenuClassName : DropdownMenuClassName
}

const NavbarDropdown: React.FunctionComponent<Props> = ({ buttonText, children }) => {
    const [show, setShow] = React.useState<boolean>(false)
    const toggleShow = React.useCallback(
        () => setShow(!show),
        [show, setShow]
    )

    const dropdownRef = React.useRef<HTMLLIElement>(null)

    React.useLayoutEffect(() => {
        const dropdown = dropdownRef.current
        if (dropdown === null) return
        const hide = (event: MouseEvent) => {
            if (event.target === null) return
            const target = event.target as Node
            if (dropdown.contains(target)) return
            setShow(false)
        }
        window.addEventListener('click', hide)
        return () => window.removeEventListener('click', hide)
    }, [show, setShow])

    return (
        <li className="nav-item dropdown" ref={dropdownRef}>
            <button onClick={toggleShow} className="nav-link dropdown-toggle">
                {buttonText}
            </button>
            <ul className={getDropdownMenuClassName(show)}>
                {children}
            </ul>
        </li>
    )
}

export default NavbarDropdown