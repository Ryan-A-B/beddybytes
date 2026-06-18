import React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { IconButton } from '../IconButton'
import { TextInput, TextInputProps } from '../TextInput'

export type PasswordInputProps = Omit<TextInputProps, 'type'>

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const [visible, set_visible] = React.useState(false)

  return (
    <div className="relative">
      <TextInput
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className="pr-14"
      />
      <div className="absolute inset-y-0 right-1 flex items-center">
        <IconButton
          type="button"
          label={visible ? 'Hide password' : 'Show password'}
          size="sm"
          variant="ghost"
          onClick={() => set_visible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </IconButton>
      </div>
    </div>
  )
})

PasswordInput.displayName = 'PasswordInput'
