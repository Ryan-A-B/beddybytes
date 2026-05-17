import React from 'react'
import { classNames } from '../classNames'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  full_width?: boolean
  loading?: boolean
}

const variant_classes: Record<ButtonVariant, string> = {
  primary: 'bg-action text-[rgb(var(--bb-color-text-inverse))] hover:bg-action-strong border-transparent',
  secondary: 'bg-surface text-text border-border hover:bg-muted',
  ghost: 'bg-transparent text-text border-transparent hover:bg-muted',
  danger: 'bg-danger text-[rgb(var(--bb-color-text-inverse))] hover:brightness-95 border-transparent',
}

const size_classes: Record<ButtonSize, string> = {
  sm: 'h-[var(--bb-button-height-sm)] px-[var(--bb-button-padding-x-sm)] text-sm',
  md: 'h-[var(--bb-button-height-md)] px-[var(--bb-button-padding-x-md)] text-base',
  lg: 'h-[var(--bb-button-height-lg)] px-[var(--bb-button-padding-x-lg)] text-lg',
}

export const Button: React.FunctionComponent<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  full_width = false,
  loading = false,
  className,
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition disabled:cursor-not-allowed disabled:opacity-55',
        'focus-visible:outline-none focus-visible:shadow-[var(--bb-focus-ring)]',
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
