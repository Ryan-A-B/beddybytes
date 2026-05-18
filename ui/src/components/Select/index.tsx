import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { classNames } from '../classNames'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  caret_tone?: 'default' | 'disabled'
  invalid?: boolean
  leading_icon?: React.ReactNode
  menu_placement?: 'bottom' | 'top'
  select_className?: string
}

interface SelectOption {
  disabled: boolean
  label: React.ReactNode
  value: string
}

const get_options = (children: React.ReactNode): SelectOption[] => {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child)) {
      return []
    }

    const value = child.props.value?.toString() ?? child.props.children?.toString() ?? ''

    return [{
      disabled: Boolean(child.props.disabled),
      label: child.props.children,
      value,
    }]
  })
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ caret_tone = 'default', invalid = false, leading_icon, menu_placement = 'bottom', className, select_className, children, disabled, value, defaultValue, onChange, name, id, required, ...props }, ref) => {
    const options = React.useMemo(() => get_options(children), [children])
    const initial_value = defaultValue?.toString() ?? options[0]?.value ?? ''
    const [internal_value, set_internal_value] = React.useState(initial_value)
    const [is_open, set_is_open] = React.useState(false)
    const select_ref = React.useRef<HTMLSelectElement | null>(null)
    const listbox_id = React.useId()
    const selected_value = value?.toString() ?? internal_value
    const selected_option = options.find((option) => option.value === selected_value) ?? options[0]

    React.useImperativeHandle(ref, () => select_ref.current as HTMLSelectElement)

    const select_option = (next_value: string): void => {
      set_internal_value(next_value)
      set_is_open(false)

      if (select_ref.current) {
        select_ref.current.value = next_value
        select_ref.current.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    return (
      <span className={classNames('relative grid w-full', className)}>
        <select
          {...props}
          ref={select_ref}
          name={name}
          id={id}
          required={required}
          disabled={disabled}
          value={selected_value}
          aria-invalid={invalid || props['aria-invalid']}
          className="sr-only"
          onChange={(event) => {
            set_internal_value(event.currentTarget.value)
            onChange?.(event)
          }}
          tabIndex={-1}
        >
          {children}
        </select>

        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={is_open}
          aria-controls={listbox_id}
          disabled={disabled}
          className={classNames(
            'grid h-[var(--bb-input-height)] w-full items-center rounded-md border bg-[var(--bb-input-background)] text-left text-text',
            leading_icon ? 'grid-cols-[auto_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
            leading_icon ? 'pl-0' : 'pl-[var(--bb-input-padding-x)]',
            'pr-3 transition disabled:cursor-not-allowed disabled:opacity-55',
            'focus-visible:outline-none focus-visible:shadow-[var(--bb-focus-ring)]',
            invalid ? 'border-danger' : 'border-[var(--bb-input-border)] hover:border-[rgb(var(--bb-color-border-strong))]',
            select_className
          )}
          onClick={() => set_is_open((current) => !current)}
          onBlur={(event) => {
            if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
              set_is_open(false)
            }
          }}
        >
          {leading_icon ? (
            <span className="grid w-10 place-items-center text-text">
              {leading_icon}
            </span>
          ) : null}
          <span className="truncate">{selected_option?.label}</span>
          <FontAwesomeIcon icon={faChevronDown} className={classNames('ml-3', caret_tone === 'disabled' ? 'text-[rgb(var(--bb-colour-text-disabled))]' : 'text-subdued')} />
        </button>

        {is_open ? (
          <div
            id={listbox_id}
            role="listbox"
            className={classNames(
              'absolute left-0 right-0 z-40 max-h-56 overflow-auto rounded-md border border-border bg-[rgb(var(--bb-color-surface))] p-1 shadow-[var(--bb-shadow-lg)]',
              menu_placement === 'top' ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'
            )}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === selected_value}
                disabled={option.disabled}
                className={classNames(
                  'grid min-h-9 w-full items-center rounded px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-55',
                  option.value === selected_value
                    ? 'bg-[var(--bb-select-option-selected)] text-[var(--bb-select-option-on-selected)]'
                    : 'text-text hover:bg-[var(--bb-select-option-hover)] hover:text-text'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select_option(option.value)}
              >
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </span>
    )
  }
)

Select.displayName = 'Select'
