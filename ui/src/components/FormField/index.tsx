import React from 'react'
import { classNames } from '../classNames'

export interface FormFieldProps {
  label: React.ReactNode
  html_for?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const FormField: React.FunctionComponent<FormFieldProps> = ({
  label,
  html_for,
  hint,
  error,
  children,
  className,
}) => (
  <div className={classNames('grid gap-2', className)}>
    <label htmlFor={html_for} className="text-sm font-semibold leading-snug text-text">
      {label}
    </label>
    {children}
    {hint && !error && <p className="m-0 text-sm text-subdued">{hint}</p>}
    {error && <p className="m-0 text-sm font-medium text-danger">{error}</p>}
  </div>
)
