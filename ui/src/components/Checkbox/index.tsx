import React from 'react'
import { classNames } from '../classNames'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, ...props }, ref) => (
    <label className={classNames('inline-flex items-start gap-3 text-sm text-text', className)}>
      <input
        {...props}
        ref={ref}
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-border bg-surface text-action focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      />
      {label && <span>{label}</span>}
    </label>
  )
)

Checkbox.displayName = 'Checkbox'
