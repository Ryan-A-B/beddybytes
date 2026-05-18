import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircle, faExpand, faPictureInPicture, faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons'
import { classNames } from '../classNames'

export interface VideoControlsProps extends React.HTMLAttributes<HTMLDivElement> {
  is_muted?: boolean
  on_full_screen?: () => void
  on_mute?: () => void
  on_picture_in_picture?: () => void
  on_record?: () => void
}

interface VideoControlButtonProps {
  children: React.ReactNode
  label: string
  on_click?: () => void
  tone?: 'default' | 'record'
}

const VideoControlButton: React.FunctionComponent<VideoControlButtonProps> = ({
  children,
  label,
  on_click,
  tone = 'default',
}) => (
  <button
    type="button"
    aria-label={label}
    className={classNames(
      'grid h-11 w-11 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:shadow-[var(--bb-focus-ring)]',
      tone === 'record'
        ? 'border-[rgb(var(--bb-colour-danger-400)/0.56)] bg-[rgb(var(--bb-colour-danger-500)/0.16)] text-[rgb(var(--bb-colour-danger-200))] hover:bg-[rgb(var(--bb-colour-danger-500)/0.26)]'
        : 'border-[rgb(var(--bb-color-border)/var(--bb-border-opacity-default,0.26))] bg-[var(--bb-background-default)] text-text hover:border-[rgb(var(--bb-colour-role-parent-info)/0.42)]'
    )}
    onClick={on_click}
  >
    {children}
  </button>
)

export const VideoControls: React.FunctionComponent<VideoControlsProps> = ({
  is_muted = false,
  on_full_screen,
  on_mute,
  on_picture_in_picture,
  on_record,
  className,
  ...props
}) => (
  <div
    {...props}
    className={classNames(
      'inline-flex items-center gap-2 rounded-full border border-[rgb(var(--bb-color-border)/var(--bb-border-opacity-default,0.24))] bg-[rgb(var(--bb-colour-neutral-black)/0.62)] p-1.5 shadow-[var(--bb-shadow-soft)] backdrop-blur',
      className
    )}
  >
    <VideoControlButton label="Record video" tone="record" on_click={on_record}>
      <FontAwesomeIcon icon={faCircle} className="text-sm" />
    </VideoControlButton>
    <VideoControlButton label={is_muted ? 'Unmute audio' : 'Mute audio'} on_click={on_mute}>
      <FontAwesomeIcon icon={is_muted ? faVolumeXmark : faVolumeHigh} />
    </VideoControlButton>
    <VideoControlButton label="Enter full screen" on_click={on_full_screen}>
      <FontAwesomeIcon icon={faExpand} />
    </VideoControlButton>
    <VideoControlButton label="Open picture in picture" on_click={on_picture_in_picture}>
      <FontAwesomeIcon icon={faPictureInPicture} />
    </VideoControlButton>
  </div>
)
