import React from 'react'
import { classNames } from '../classNames'

export type ConnectionStatusTone = 'connected' | 'streaming' | 'waiting' | 'idle'

export interface ConnectionStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string
  value: string
  tone?: ConnectionStatusTone
}

const tone_classes: Record<ConnectionStatusTone, string> = {
  connected: 'border-parent-info/40 bg-parent-info/15 text-parent-info',
  streaming: 'border-baby-info/40 bg-baby-info/15 text-baby-info',
  waiting: 'border-input-border bg-surface text-subdued',
  idle: 'border-input-border bg-surface text-text',
}

const dot_classes: Record<ConnectionStatusTone, string> = {
  connected: 'bg-parent-info',
  streaming: 'bg-baby-info',
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
