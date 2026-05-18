import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock, faPlay, faRotateRight } from '@fortawesome/free-solid-svg-icons'
import { classNames } from '../classNames'

export interface SessionTimerProps extends React.HTMLAttributes<HTMLDivElement> {
  elapsed: string
  on_play?: () => void
  on_restart?: () => void
}

export const SessionTimer: React.FunctionComponent<SessionTimerProps> = ({
  elapsed,
  on_play,
  on_restart,
  className,
  ...props
}) => (
  <div
    {...props}
    className={classNames(
      'inline-flex min-h-14 items-center gap-2 rounded-full border border-[rgb(var(--bb-color-border)/var(--bb-border-opacity-default,0.22))] bg-[var(--bb-background-default)] p-1.5 shadow-[var(--bb-shadow-soft)]',
      className
    )}
  >
    <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--bb-background-default)] px-4 font-mono text-sm text-text">
      <FontAwesomeIcon icon={faClock} className="text-[rgb(var(--bb-colour-role-parent-info))]" />
      {elapsed}
    </span>
    <button
      type="button"
      aria-label="Start listening"
      className="grid h-10 w-10 place-items-center rounded-full border border-[rgb(var(--bb-colour-role-parent-action))] bg-[rgb(var(--bb-colour-role-parent-action))] text-[rgb(var(--bb-colour-role-parent-on-action))]"
      onClick={on_play}
    >
      <FontAwesomeIcon icon={faPlay} className="text-xs" />
    </button>
    <button
      type="button"
      aria-label="Restart timer"
      className="grid h-10 w-10 place-items-center rounded-full border border-[rgb(var(--bb-color-border)/var(--bb-border-opacity-default,0.22))] text-subdued hover:text-text"
      onClick={on_restart}
    >
      <FontAwesomeIcon icon={faRotateRight} />
    </button>
  </div>
)
