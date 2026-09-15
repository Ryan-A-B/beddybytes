import React from 'react'
import { classNames } from '../classNames'

export type BadgeTone = 'neutral' | 'action' | 'success' | 'warning' | 'danger'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const tone_classes: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-text border-border',
  action: 'bg-action/15 text-action border-action/25',
  success: 'bg-success-soft/90 text-success border-success/25',
  warning: 'bg-warning-soft/90 text-warning border-warning/25',
  danger: 'bg-danger-soft/90 text-danger border-danger/25',
}

export const Badge: React.FunctionComponent<BadgeProps> = ({
  tone = 'neutral',
  className,
  children,
  ...props
}) => (
  <span
    {...props}
    className={classNames('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', tone_classes[tone], className)}
  >
    {children}
  </span>
)
