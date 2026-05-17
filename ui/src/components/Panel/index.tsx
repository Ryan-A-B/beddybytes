import React from 'react'
import { classNames } from '../classNames'

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'default' | 'muted' | 'raised'
}

const tone_classes = {
  default: 'bg-[var(--bb-background-default)] border-[rgb(var(--bb-color-border)/var(--bb-border-opacity-default,1))]',
  muted: 'bg-muted border-border',
  raised: 'bg-raised border-border shadow-raised',
}

export const Panel: React.FunctionComponent<PanelProps> = ({
  tone = 'default',
  className,
  children,
  ...props
}) => (
  <div
    {...props}
    className={classNames('rounded-lg border p-[var(--bb-panel-padding)] text-text', tone_classes[tone], className)}
  >
    {children}
  </div>
)
