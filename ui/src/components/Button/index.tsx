import React from 'react'
import { classNames } from '../classNames'

export type ButtonVariant = 'primary' | 'baby-action' | 'parent-action' | 'secondary'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
  size?: ButtonSize
  full_width?: boolean
  loading?: boolean
}

const variant_classes: Record<ButtonVariant, string> = {
  primary: 'border-primary-action bg-primary-action text-primary-on-action hover:bg-primary-action-hover',
  'baby-action': 'border-baby-action bg-baby-action text-baby-on-action hover:bg-baby-action-hover',
  'parent-action': 'border-parent-action bg-parent-action text-parent-on-action hover:bg-parent-action-hover',
  secondary: 'border-secondary bg-secondary text-on-secondary hover:bg-secondary-hover',
}

const size_classes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-12 px-5 text-lg',
}

export const Button: React.FunctionComponent<ButtonProps> = ({
  variant,
  size = 'md',
  full_width = false,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition disabled:cursor-not-allowed disabled:opacity-55',
        'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
        variant_classes[variant],
        size_classes[size],
        full_width && 'w-full',
        className
      )}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin"
        />
      )}
      {children}
    </button>
  )
}
