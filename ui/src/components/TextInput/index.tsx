import React from 'react'
import { classNames } from '../classNames'

export interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  invalid?: boolean
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ invalid = false, className, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      aria-invalid={invalid || props['aria-invalid']}
      className={classNames(
        'h-11 w-full rounded-md border bg-input px-4 text-text placeholder:text-subdued',
        'transition focus-ring',
        invalid ? 'border-danger' : 'border-input-border hover:border-input-border-hover',
        className
      )}
    />
  )
)

TextInput.displayName = 'TextInput'
