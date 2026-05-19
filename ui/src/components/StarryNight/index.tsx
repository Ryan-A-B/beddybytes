import React from 'react'
import { classNames } from '../classNames'

export interface StarryNightProps extends React.HTMLAttributes<HTMLDivElement> {
  seed: string
  count?: number
}

interface Star {
  left: number
  top: number
  size: number
  opacity: number
  blur: number
}

const hash_seed = (seed: string): number => {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const next_value = (value: number): number => {
  return (Math.imul(value, 1664525) + 1013904223) >>> 0
}

const build_stars = (seed: string, count: number): Star[] => {
  const stars: Star[] = []
  let state = hash_seed(`${seed}:${count}`)

  for (let index = 0; index < count; index += 1) {
    state = next_value(state)
    const left = (state / 4294967295) * 100
    state = next_value(state)
    const top = (state / 4294967295) * 100
    state = next_value(state)
    const size = 1 + (state / 4294967295) * 1.8
    state = next_value(state)
    const opacity = 0.28 + (state / 4294967295) * 0.56
    state = next_value(state)
    const blur = (state / 4294967295) > 0.86 ? 4 : 0

    stars.push({ left, top, size, opacity, blur })
  }

  return stars
}

export const StarryNight: React.FunctionComponent<StarryNightProps> = ({
  seed,
  count = 40,
  className,
  children,
  ...props
}) => {
  const stars = React.useMemo(() => build_stars(seed, count), [seed, count])

  return (
    <div {...props} className={classNames('starry-night relative isolate overflow-hidden', className)}>
      <div aria-hidden="true" className="starry-night-stars absolute inset-0 -z-10">
        {stars.map((star, index) => (
          <span
            key={`${seed}-${count}-${index}`}
            className="absolute rounded-full bg-[var(--starry-sky-star)]"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              boxShadow: star.blur ? `0 0 ${star.blur}px var(--starry-sky-glow)` : undefined,
            }}
          />
        ))}
      </div>
      {children}
    </div>
  )
}
