import React from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { classNames } from '../classNames'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
  tone?: AlertTone
  title?: React.ReactNode
  children: React.ReactNode
  className?: string
}

const tone_classes: Record<AlertTone, string> = {
  info: 'border-action/35 bg-action/10 text-text',
  success: 'border-success/35 bg-success-soft/70 text-text',
  warning: 'border-warning/35 bg-warning-soft/70 text-text',
  danger: 'border-danger/35 bg-danger-soft/70 text-text',
}

const icons: Record<AlertTone, React.ReactNode> = {
  info: <Info size={20} />,
  success: <CheckCircle2 size={20} />,
  warning: <TriangleAlert size={20} />,
  danger: <AlertCircle size={20} />,
}

export const Alert: React.FunctionComponent<AlertProps> = ({
  tone = 'info',
  title,
  children,
  className,
}) => (
  <div
    role={tone === 'danger' ? 'alert' : 'status'}
    className={classNames('flex gap-3 rounded-md border p-4 text-sm shadow-soft', tone_classes[tone], className)}
  >
    <span className="mt-0.5 shrink-0 text-current">{icons[tone]}</span>
    <div className="grid gap-1">
      {title && <p className="m-0 font-semibold">{title}</p>}
      <div className="text-subdued">{children}</div>
    </div>
  </div>
)
