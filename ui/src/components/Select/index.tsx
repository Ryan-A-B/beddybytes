import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { classNames } from '../classNames'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  leading_icon?: React.ReactNode
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid = false, leading_icon, className, children, disabled, ...props }, ref) => (
    <span className={classNames('relative grid w-full', className)}>
      {leading_icon ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 z-10 grid w-10 place-items-center text-text">
          {leading_icon}
        </span>
      ) : null}

      <select
        {...props}
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || props['aria-invalid']}
        className={classNames(
          'h-11 w-full appearance-none truncate rounded-md border bg-input text-text',
          leading_icon ? 'pl-10' : 'pl-4',
          'pr-10 transition focus-ring disabled:cursor-not-allowed disabled:opacity-55',
          invalid ? 'border-danger' : 'border-input-border hover:border-input-border-hover'
        )}
      >
        {children}
      </select>

      <FontAwesomeIcon
        icon={faChevronDown}
        className={classNames(
          'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2',
          disabled ? 'text-disabled' : 'text-subdued'
        )}
      />
    </span>
  )
)

Select.displayName = 'Select'
