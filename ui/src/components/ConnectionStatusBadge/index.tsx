import React from 'react'
import { classNames } from '../classNames'

export type ConnectionStatusTone = 'connected' | 'streaming' | 'waiting' | 'idle'

export interface ConnectionStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string
  value: string
  tone?: ConnectionStatusTone
}

const tone_classes: Record<ConnectionStatusTone, string> = {
  connected: 'border-[rgb(var(--bb-colour-role-parent-info)/0.42)] bg-[rgb(var(--bb-colour-role-parent-info)/0.14)] text-[rgb(var(--bb-colour-role-parent-info))]',
  streaming: 'border-[rgb(var(--bb-colour-role-baby-info)/0.42)] bg-[rgb(var(--bb-colour-role-baby-info)/0.14)] text-[rgb(var(--bb-colour-role-baby-info))]',
  waiting: 'border-[rgb(var(--bb-color-border)/var(--bb-border-opacity-default,0.22))] bg-[var(--bb-background-default)] text-subdued',
  idle: 'border-[rgb(var(--bb-color-border)/var(--bb-border-opacity-default,0.22))] bg-[var(--bb-background-default)] text-text',
}

const dot_classes: Record<ConnectionStatusTone, string> = {
  connected: 'bg-[rgb(var(--bb-colour-role-parent-info))] shadow-[0_0_10px_rgb(var(--bb-colour-role-parent-info)/0.52)]',
  streaming: 'bg-[rgb(var(--bb-colour-role-baby-info))] shadow-[0_0_10px_rgb(var(--bb-colour-role-baby-info)/0.52)]',
  waiting: 'bg-subdued',
  idle: 'bg-text',
}

export const ConnectionStatusBadge: React.FunctionComponent<ConnectionStatusBadgeProps> = ({
  label,
  value,
  tone = 'idle',
  className,
  ...props
}) => (
  <span
    {...props}
    className={classNames(
      'inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-bold uppercase tracking-[0.16em]',
      tone_classes[tone],
      className
    )}
  >
    <span className={classNames('h-1.5 w-1.5 rounded-full', dot_classes[tone])} />
    <span>{label}</span>
    <span className="text-subdued">·</span>
    <span className="font-medium normal-case tracking-normal">{value}</span>
  </span>
)
