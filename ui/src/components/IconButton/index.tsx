import React from 'react'
import { classNames } from '../classNames'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const variant_classes = {
  secondary: 'bg-surface text-text border-border hover:bg-muted',
  ghost: 'bg-transparent text-text border-transparent hover:bg-muted',
  danger: 'bg-danger text-on-action border-transparent hover:brightness-95',
}

const size_classes = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
}

export const IconButton: React.FunctionComponent<IconButtonProps> = ({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...props
}) => (
  <button
    {...props}
    aria-label={label}
    title={label}
    className={classNames(
      'inline-flex shrink-0 items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-55',
      variant_classes[variant],
      size_classes[size],
      className
    )}
  >
    {children}
  </button>
)
