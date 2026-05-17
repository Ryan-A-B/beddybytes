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
        'h-[var(--bb-input-height)] w-full rounded-md border bg-[var(--bb-input-background)] px-[var(--bb-input-padding-x)] text-text placeholder:text-subdued',
        'transition focus-visible:outline-none focus-visible:shadow-[var(--bb-focus-ring)]',
        invalid ? 'border-danger' : 'border-[var(--bb-input-border)] hover:border-[rgb(var(--bb-color-border-strong))]',
        className
      )}
    />
  )
)

TextInput.displayName = 'TextInput'
