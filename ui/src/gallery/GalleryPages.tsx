import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faCircleDot } from '@fortawesome/free-regular-svg-icons'
import { faBaby, faBars, faChevronDown, faCircle, faClock, faDisplay, faExpand, faGear, faMicrophone, faPenToSquare, faPictureInPicture, faPlay, faRotateRight, faTag, faVideo, faVolumeHigh, faVolumeXmark, faWandMagicSparkles, faXmark } from '@fortawesome/free-solid-svg-icons'
import { AlignLeft, Ban, Bell, Camera, Info, Moon, MousePointer, Settings, Sun, Type } from 'lucide-react'
import design_markdown from '../../DESIGN.md?raw'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ConnectionStatusBadge,
  FormField,
  IconButton,
  Panel,
  PasswordInput,
  Select,
  SessionTimer,
  StarryNight,
  StarrySky,
  TextInput,
  VideoControls,
} from '../index'
import { AppShellPrototype } from '../examples/prototype/AppShellPrototype'
import {
  AppBabyStationLivePrototype,
  AppBabyStationStartPrototype,
  AppHomePrototypeOne,
  AppParentStationLivePrototype,
  AppParentStationPrototype,
} from '../examples/prototype/AppHomePrototypes'
import { MarketingPagePrototype } from '../examples/prototype/MarketingPagePrototype'

type ThemeName = 'dark' | 'light'
type PageName = 'brand' | 'alias' | 'mapped' | 'components' | 'design' | 'prototype-app-home' | 'prototype-baby-station-start' | 'prototype-baby-station-live' | 'prototype-parent-station' | 'prototype-parent-station-live' | 'prototype-app-shell' | 'prototype-marketing'

interface DesignDocParts {
  metadata: string
  body: string
}

interface ColourScale {
  name: string
  stops: Array<{
    index: string
    token: string
    hex: string
  }>
}

const colour_scales: ColourScale[] = [
  {
    name: 'Gray',
    stops: [
      { index: '100', token: 'gray-100', hex: '#f4f7f8' },
      { index: '200', token: 'gray-200', hex: '#c8cccf' },
      { index: '300', token: 'gray-300', hex: '#9ca2a6' },
      { index: '400', token: 'gray-400', hex: '#70777c' },
      { index: '500', token: 'gray-500', hex: '#444d53' },
      { index: '600', token: 'gray-600', hex: '#363e42' },
      { index: '700', token: 'gray-700', hex: '#292e32' },
      { index: '800', token: 'gray-800', hex: '#1b1f21' },
    ],
  },
  {
    name: 'Indigo',
    stops: [
      { index: '100', token: 'indigo-100', hex: '#d1d1eb' },
      { index: '200', token: 'indigo-200', hex: '#a2a2d7' },
      { index: '300', token: 'indigo-300', hex: '#7474c3' },
      { index: '400', token: 'indigo-400', hex: '#4545af' },
      { index: '500', token: 'indigo-500', hex: '#17179b' },
      { index: '600', token: 'indigo-600', hex: '#12127c' },
      { index: '700', token: 'indigo-700', hex: '#0e0e5d' },
      { index: '800', token: 'indigo-800', hex: '#09093e' },
      { index: '900', token: 'indigo-900', hex: '#05051f' },
      { index: '950', token: 'indigo-950', hex: '#020210' },
    ],
  },
  {
    name: 'Sky',
    stops: [
      { index: '100', token: 'sky-100', hex: '#cceef6' },
      { index: '200', token: 'sky-200', hex: '#99dded' },
      { index: '300', token: 'sky-300', hex: '#66cce4' },
      { index: '400', token: 'sky-400', hex: '#33bbdb' },
      { index: '500', token: 'sky-500', hex: '#00aad2' },
      { index: '600', token: 'sky-600', hex: '#0088a8' },
      { index: '700', token: 'sky-700', hex: '#00667e' },
      { index: '800', token: 'sky-800', hex: '#004454' },
    ],
  },
  {
    name: 'Mint',
    stops: [
      { index: '100', token: 'mint-100', hex: '#ccf2e5' },
      { index: '200', token: 'mint-200', hex: '#99e5cc' },
      { index: '300', token: 'mint-300', hex: '#66d8b2' },
      { index: '400', token: 'mint-400', hex: '#33cb99' },
      { index: '500', token: 'mint-500', hex: '#00be7f' },
      { index: '600', token: 'mint-600', hex: '#009866' },
      { index: '700', token: 'mint-700', hex: '#00724c' },
      { index: '800', token: 'mint-800', hex: '#004c33' },
    ],
  },
  {
    name: 'Gold',
    stops: [
      { index: '100', token: 'gold-100', hex: '#feeccc' },
      { index: '200', token: 'gold-200', hex: '#fdd999' },
      { index: '300', token: 'gold-300', hex: '#fdc766' },
      { index: '400', token: 'gold-400', hex: '#fcb433' },
      { index: '500', token: 'gold-500', hex: '#fba100' },
      { index: '600', token: 'gold-600', hex: '#c98100' },
      { index: '700', token: 'gold-700', hex: '#976100' },
      { index: '800', token: 'gold-800', hex: '#644000' },
    ],
  },
  {
    name: 'Coral',
    stops: [
      { index: '100', token: 'coral-100', hex: '#fbd7d6' },
      { index: '200', token: 'coral-200', hex: '#f6b0ad' },
      { index: '300', token: 'coral-300', hex: '#f28884' },
      { index: '400', token: 'coral-400', hex: '#ed615b' },
      { index: '500', token: 'coral-500', hex: '#e93932' },
      { index: '600', token: 'coral-600', hex: '#ba2e28' },
      { index: '700', token: 'coral-700', hex: '#8c221e' },
      { index: '800', token: 'coral-800', hex: '#5d1714' },
    ],
  },
]

const alias_colour_categories = [
  { name: 'Primary', source: 'Indigo', token: 'primary' },
  { name: 'Info', source: 'Sky', token: 'info' },
  { name: 'Success', source: 'Mint', token: 'success' },
  { name: 'Warning', source: 'Gold', token: 'warning' },
  { name: 'Danger', source: 'Coral', token: 'danger' },
  { name: 'Neutral', source: 'Gray', token: 'neutral' },
]

const alias_role_colour_categories = [
  { name: 'Baby station', source: 'Indigo', token: 'role-baby' },
  { name: 'Parent station', source: 'Mint', token: 'role-parent' },
]

const prototype_pages: Array<{ id: PageName; label: string }> = [
  { id: 'prototype-app-home', label: 'App Home' },
  { id: 'prototype-baby-station-start', label: 'Baby Station Start' },
  { id: 'prototype-baby-station-live', label: 'Baby Station Live' },
  { id: 'prototype-parent-station', label: 'Parent Station' },
  { id: 'prototype-parent-station-live', label: 'Parent Station Live' },
  { id: 'prototype-app-shell', label: 'App Shell' },
  { id: 'prototype-marketing', label: 'Marketing' },
]

const themed_pages: PageName[] = [
  'mapped',
  'components',
  'prototype-app-home',
  'prototype-baby-station-start',
  'prototype-baby-station-live',
  'prototype-parent-station',
  'prototype-parent-station-live',
  'prototype-app-shell',
  'prototype-marketing',
]

const page_routes: Record<PageName, string> = {
  brand: '/brand',
  alias: '/alias',
  mapped: '/mapped',
  components: '/components',
  design: '/design',
  'prototype-app-home': '/prototypes/app-home',
  'prototype-baby-station-start': '/prototypes/baby-station-start',
  'prototype-baby-station-live': '/prototypes/baby-station-live',
  'prototype-parent-station': '/prototypes/parent-station',
  'prototype-parent-station-live': '/prototypes/parent-station-live',
  'prototype-app-shell': '/prototypes/app-shell',
  'prototype-marketing': '/prototypes/marketing',
}

const route_pages = Object.entries(page_routes).reduce<Record<string, PageName>>((routes, [page, route]) => {
  routes[route] = page as PageName
  return routes
}, {})

const is_themed_page = (page: PageName): boolean => themed_pages.includes(page)

const get_page_from_path = (pathname: string): PageName => route_pages[pathname] ?? 'brand'

const get_theme_from_search = (search: string): ThemeName => {
  const theme = new URLSearchParams(search).get('theme')
  return theme === 'dark' ? 'dark' : 'light'
}

const is_embed_route = (search: string): boolean => new URLSearchParams(search).get('embed') === '1'

const get_route = (page: PageName, theme: ThemeName, embed = false): string => {
  const route = page_routes[page]
  const params = new URLSearchParams()

  if (is_themed_page(page)) {
    params.set('theme', theme)
  }

  if (embed) {
    params.set('embed', '1')
  }

  const query = params.toString()

  return query ? `${route}?${query}` : route
}

const split_design_doc = (source: string): DesignDocParts => {
  if (!source.startsWith('---')) {
    return { metadata: '', body: source }
  }

  const [, metadata = '', body = ''] = source.split('---')
  return { metadata: metadata.trim(), body: body.trim() }
}

const render_inline_markdown = (text: string, key_prefix: string): React.ReactNode[] => {
  const parts = text.split(/(`[^`]+`|\*\*.+?\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${key_prefix}-${index}`}>{part.slice(1, -1)}</code>
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${key_prefix}-${index}`}>{part.slice(2, -2)}</strong>
    }

    return part
  })
}

const render_markdown_line = (line: string, index: number): React.ReactNode => {
  if (line.startsWith('## ')) {
    return <h2 key={index}>{line.slice(3)}</h2>
  }

  if (line.startsWith('### ')) {
    return <h3 key={index}>{line.slice(4)}</h3>
  }

  if (line.startsWith('- ')) {
    return <li key={index}>{render_inline_markdown(line.slice(2), `li-${index}`)}</li>
  }

  return <p key={index}>{render_inline_markdown(line, `p-${index}`)}</p>
}

const render_design_markdown = (source: string): React.ReactNode[] => {
  const rendered_lines: React.ReactNode[] = []
  let list_items: React.ReactNode[] = []

  source.split('\n').forEach((line, index) => {
    const trimmed_line = line.trim()

    if (!trimmed_line) {
      if (list_items.length) {
        rendered_lines.push(<ul key={`list-${index}`}>{list_items}</ul>)
        list_items = []
      }

      return
    }

    if (trimmed_line.startsWith('- ')) {
      list_items.push(render_markdown_line(trimmed_line, index))
      return
    }

    if (list_items.length) {
      rendered_lines.push(<ul key={`list-${index}`}>{list_items}</ul>)
      list_items = []
    }

    rendered_lines.push(render_markdown_line(trimmed_line, index))
  })

  if (list_items.length) {
    rendered_lines.push(<ul key="list-final">{list_items}</ul>)
  }

  return rendered_lines
}

const alias_colour_stops = ['100', '200', '300', '400', '500', '600', '700', '800']

const border_width_tokens = [
  ['None', '--bb-border-width-none'],
  ['Sm', '--bb-border-width-sm'],
  ['Md', '--bb-border-width-md'],
  ['Lg', '--bb-border-width-lg'],
]

const border_radius_tokens = [
  ['0', '--bb-border-radius-0'],
  ['50', '--bb-border-radius-50'],
  ['100', '--bb-border-radius-100'],
  ['200', '--bb-border-radius-200'],
]

const font_weights = [
  { name: 'Regular', value: 400 },
  { name: 'Medium', value: 500 },
  { name: 'Semi bold', value: 600 },
  { name: 'Bold', value: 700 },
]

const scale_steps = [
  { index: '0', value: '0px' },
  { index: '25', value: '2px' },
  { index: '50', value: '4px' },
  { index: '100', value: '8px' },
  { index: '150', value: '12px' },
  { index: '200', value: '16px' },
  { index: '250', value: '20px' },
  { index: '300', value: '24px' },
  { index: '350', value: '28px' },
  { index: '400', value: '32px' },
  { index: '500', value: '40px' },
  { index: '600', value: '48px' },
  { index: '700', value: '64px' },
  { index: '800', value: '96px' },
  { index: '900', value: '128px' },
]

const brand_icons: Array<{ name: string; icon: IconDefinition; style: 'Solid' | 'Regular' }> = [
  { name: 'Baby station', icon: faBaby, style: 'Solid' },
  { name: 'Parent station', icon: faDisplay, style: 'Solid' },
  { name: 'Microphone permission', icon: faMicrophone, style: 'Solid' },
  { name: 'Camera permission', icon: faVideo, style: 'Solid' },
  { name: 'Configuration', icon: faGear, style: 'Solid' },
  { name: 'Station name', icon: faTag, style: 'Solid' },
  { name: 'Edit', icon: faPenToSquare, style: 'Solid' },
  { name: 'Select', icon: faChevronDown, style: 'Solid' },
  { name: 'Session timer', icon: faClock, style: 'Solid' },
  { name: 'Session play', icon: faPlay, style: 'Solid' },
  { name: 'Session restart', icon: faRotateRight, style: 'Solid' },
  { name: 'Video record', icon: faCircle, style: 'Solid' },
  { name: 'Video volume', icon: faVolumeHigh, style: 'Solid' },
  { name: 'Video mute', icon: faVolumeXmark, style: 'Solid' },
  { name: 'Video full screen', icon: faExpand, style: 'Solid' },
  { name: 'Picture in picture', icon: faPictureInPicture, style: 'Solid' },
  { name: 'Menu', icon: faBars, style: 'Solid' },
  { name: 'Close', icon: faXmark, style: 'Solid' },
  { name: 'Active state', icon: faCircleDot, style: 'Regular' },
  { name: 'Reassurance', icon: faWandMagicSparkles, style: 'Solid' },
]

const alias_icon_usages = [
  { name: 'Station roles', usage: 'Use baby and display for station identity, route labels, and station-specific setup flows.' },
  { name: 'Permissions', usage: 'Use microphone and camera when requesting, confirming, or troubleshooting browser media access.' },
  { name: 'Configuration', usage: 'Use gear for station settings, tag for station naming, and edit for explicit rename actions.' },
  { name: 'Select controls', usage: 'Use chevron-down on the right edge of custom select controls.' },
  { name: 'Session controls', usage: 'Use clock, play, and restart for compact monitoring session timing controls.' },
  { name: 'Video controls', usage: 'Use record, volume, mute, full-screen, and picture-in-picture icons for live video controls.' },
  { name: 'Navigation', usage: 'Use menu and close for collapsible navigation controls on mobile.' },
  { name: 'Active states', usage: 'Use the regular active-state icon when a navigation item or mode is currently selected.' },
  { name: 'Reassurance', usage: 'Use sparkle sparingly for small trust notes, not as general decoration.' },
]

const device_sizes = [
  { name: 'Mobile', range: '320px - 767px', width: '28%' },
  { name: 'Tablet', range: '768px - 1023px', width: '54%' },
  { name: 'Desktop', range: '1024px+', width: '100%' },
]

const text_roles = [
  { name: 'Heading', text_token: '--bb-colour-text-heading', icon_token: '--bb-colour-icon-default', Icon: Type },
  { name: 'Body', text_token: '--bb-colour-text-body', icon_token: '--bb-colour-icon-default', Icon: AlignLeft },
  { name: 'Action', text_token: '--bb-colour-text-action', icon_token: '--bb-colour-icon-action', Icon: MousePointer },
  { name: 'Disabled', text_token: '--bb-colour-text-disabled', icon_token: '--bb-colour-icon-disabled', Icon: Ban },
  { name: 'Information', text_token: '--bb-colour-text-information', icon_token: '--bb-colour-icon-information', Icon: Info },
]

const mapped_surface_roles = [
  {
    name: 'Page',
    surface_token: '--bb-colour-surface-page',
    border_token: '--bb-colour-border-page',
    background_token: '--bb-background-page',
    star_count: 40,
    roles: text_roles,
  },
  {
    name: 'Default',
    surface_token: '--bb-colour-surface-default',
    border_token: '--bb-colour-border-default',
    background_token: '--bb-background-default',
    star_count: 32,
    roles: text_roles,
  },
  { name: 'Success', surface_token: '--bb-colour-surface-success', border_token: '--bb-colour-border-success', roles: text_roles },
  { name: 'Warning', surface_token: '--bb-colour-surface-warning', border_token: '--bb-colour-border-warning', roles: text_roles },
  {
    name: 'Information',
    surface_token: '--bb-colour-surface-information',
    border_token: '--bb-colour-border-information',
    roles: text_roles,
  },
  { name: 'Error', surface_token: '--bb-colour-surface-error', border_token: '--bb-colour-border-error', roles: text_roles },
  { name: 'Disabled', surface_token: '--bb-colour-surface-disabled', border_token: '--bb-colour-border-disabled', roles: text_roles },
]

const desktop_type_sizes = [
  ['H1', '64px'],
  ['H2', '48px'],
  ['H3', '40px'],
  ['H4', '32px'],
  ['H5', '24px'],
  ['H6', '20px'],
  ['Paragraph large', '20px'],
  ['Paragraph medium', '16px'],
  ['Paragraph small', '12px'],
]

const mobile_type_sizes = [
  ['H1', '48px'],
  ['H2', '40px'],
  ['H3', '32px'],
  ['H4', '28px'],
  ['H5', '24px'],
  ['H6', '20px'],
  ['Paragraph large', '20px'],
  ['Paragraph medium', '16px'],
  ['Paragraph small', '12px'],
]

const GallerySection: React.FunctionComponent<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="gallery-section">
    <h2>{title}</h2>
    {children}
  </section>
)

const ColourScaleCard: React.FunctionComponent<{ scale: ColourScale }> = ({ scale }) => (
  <section className="colour-scale-card">
    <h3>{scale.name}</h3>
    <div className="colour-range">
      {scale.stops.map((stop) => {
        const variable_name = `--bb-brand-${stop.token}`

        return (
          <div key={stop.token} className="colour-stop">
            <span className="colour-swatch" style={{ background: `rgb(var(${variable_name}))` }} />
            <span className="colour-stop-copy">
              <strong>{stop.index}</strong>
              <code>{stop.hex}</code>
            </span>
          </div>
        )
      })}
    </div>
  </section>
)

const AliasColourCategoryCard: React.FunctionComponent<{ name: string; source: string; token: string }> = ({
  name,
  source,
  token,
}) => (
  <section className="alias-colour-card">
    <div>
      <h3>{name}</h3>
      <p>{source}</p>
    </div>
    <div className="alias-colour-range">
      {alias_colour_stops.map((stop) => {
        const variable_name = `--bb-colour-${token}-${stop}`

        return (
          <span
            key={variable_name}
            className="alias-colour-swatch"
            title={variable_name}
            style={{ background: `rgb(var(${variable_name}))` }}
          />
        )
      })}
    </div>
  </section>
)

const BorderTokenCard: React.FunctionComponent<{ label: string; token: string; type: 'width' | 'radius' }> = ({
  label,
  token,
  type,
}) => (
  <Panel className="border-token-card">
    <strong>{label}</strong>
    <span
      className="border-token-sample"
      style={type === 'width' ? { borderWidth: `var(${token})` } : { borderRadius: `var(${token})` }}
    />
  </Panel>
)

const BrandIconCard: React.FunctionComponent<{ name: string; icon: IconDefinition; style: string }> = ({
  name,
  icon,
  style,
}) => (
  <Panel className="brand-icon-card">
    <FontAwesomeIcon icon={icon} />
    <div>
      <strong>{name}</strong>
      <span>{style}</span>
    </div>
  </Panel>
)

const MappedSurfaceCard: React.FunctionComponent<(typeof mapped_surface_roles)[number]> = ({
  name,
  surface_token,
  border_token,
  background_token,
  star_count,
  roles,
}) => {
  const content = (
    <>
      <h3 style={{ color: `rgb(var(${roles[0]?.text_token ?? '--bb-colour-text-heading'}))` }}>{name}</h3>
      <div className="mapped-text-role-list">
        {roles.map(({ name: role_name, text_token, icon_token, Icon }) => (
          role_name === 'Action' ? (
            <a key={role_name} className="mapped-text-role mapped-action-link" href="#mapped-action-link">
              <Icon size={18} />
              <span>{role_name}</span>
            </a>
          ) : (
            <div key={role_name} className="mapped-text-role" style={{ color: `rgb(var(${text_token}))` }}>
              <Icon size={18} color={`rgb(var(${icon_token}))`} />
              <span>{role_name}</span>
            </div>
          )
        ))}
      </div>
    </>
  )
  const style = {
    background: background_token ? `var(${background_token})` : `rgb(var(${surface_token}))`,
    borderColor: border_token === '--bb-colour-border-page' ? 'transparent' : `rgb(var(${border_token}))`,
  }

  if (star_count) {
    return (
      <StarryNight seed={`mapped-${name.toLowerCase()}`} count={star_count} className="mapped-surface-card" style={style}>
        {content}
      </StarryNight>
    )
  }

  return (
    <section
      className="mapped-surface-card"
      style={style}
    >
      {content}
    </section>
  )
}

const GalleryShell: React.FunctionComponent<{ page: PageName; theme: ThemeName; set_page: (page: PageName) => void; set_theme: (theme: ThemeName) => void }> = ({
  page,
  theme,
  set_page,
  set_theme,
}) => {
  const iframe_src = get_route(page, theme, true)

  return (
  <>
    <aside className="gallery-sidebar">
      <div>
        <p className="gallery-kicker">BeddyBytes UI</p>
        <h1>Design system gallery</h1>
      </div>

      <nav className="gallery-page-nav" aria-label="Gallery pages">
        <button type="button" className={page === 'brand' ? 'active' : ''} onClick={() => set_page('brand')}>Brand</button>
        <button type="button" className={page === 'alias' ? 'active' : ''} onClick={() => set_page('alias')}>Alias</button>
        <button type="button" className={page === 'mapped' ? 'active' : ''} onClick={() => set_page('mapped')}>Mapped</button>
        <button type="button" className={page === 'components' ? 'active' : ''} onClick={() => set_page('components')}>Components</button>
        <button type="button" className={page === 'design' ? 'active' : ''} onClick={() => set_page('design')}>DESIGN.md</button>
        <div className="gallery-nav-group">
          <span className="gallery-nav-label">Prototypes</span>
          <div className="gallery-prototype-nav">
            {prototype_pages.map((prototype_page) => (
              <button
                key={prototype_page.id}
                type="button"
                className={page === prototype_page.id ? 'active' : ''}
                onClick={() => set_page(prototype_page.id)}
              >
                {prototype_page.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {is_themed_page(page) && (
        <div className="gallery-theme-switcher" aria-label="Theme">
          <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => set_theme('dark')}>
            <Moon size={16} /> Dark
          </button>
          <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => set_theme('light')}>
            <Sun size={16} /> Light
          </button>
        </div>
      )}
    </aside>

    <main className="gallery-frame-main">
      <iframe
        key={iframe_src}
        className="gallery-item-frame"
        src={iframe_src}
        title={`${page.replace(/-/g, ' ')} gallery item`}
      />
    </main>
  </>
  )
}

const GalleryItemContent: React.FunctionComponent<{ page: PageName }> = ({ page }) => (
  <>
    {page === 'brand' && <BrandPage />}
    {page === 'alias' && <AliasPage />}
    {page === 'mapped' && <MappedPage />}
    {page === 'components' && <ComponentsPage />}
    {page === 'design' && <DesignDocPage />}
    {page === 'prototype-app-home' && <PrototypePane><AppHomePrototypeOne /></PrototypePane>}
    {page === 'prototype-baby-station-start' && <PrototypePane><AppBabyStationStartPrototype /></PrototypePane>}
    {page === 'prototype-baby-station-live' && <PrototypePane><AppBabyStationLivePrototype /></PrototypePane>}
    {page === 'prototype-parent-station' && <PrototypePane><AppParentStationPrototype /></PrototypePane>}
    {page === 'prototype-parent-station-live' && <PrototypePane><AppParentStationLivePrototype /></PrototypePane>}
    {page === 'prototype-app-shell' && <PrototypePane><AppShellPrototype /></PrototypePane>}
    {page === 'prototype-marketing' && <PrototypePane><MarketingPagePrototype /></PrototypePane>}
  </>
)

const MappedActionButton: React.FunctionComponent = () => (
  <button type="button" className="mapped-action-button">
    <MousePointer size={18} />
    Surface action
  </button>
)

const PrototypePane: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => (
  <main className="gallery-prototype-main">
    {children}
  </main>
)

const DeviceSizeCard: React.FunctionComponent<{ name: string; range: string; width: string }> = ({ name, range, width }) => (
  <Panel className="device-size-card">
    <div>
      <h3>{name}</h3>
      <p>{range}</p>
    </div>
    <span className="device-size-measure" style={{ width }} />
  </Panel>
)

const TypeSizeCard: React.FunctionComponent<{ title: string; sizes: string[][] }> = ({ title, sizes }) => (
  <section
    className="type-size-card"
    style={{
      background: 'rgb(var(--bb-colour-surface-success))',
      borderColor: 'rgb(var(--bb-colour-border-success))',
    }}
  >
    <h3>{title}</h3>
    <div className="type-size-list">
      {sizes.map(([label, size]) => (
        <div key={label} className="type-size-row">
          <span className="type-size-label">{label}</span>
          <span style={{ fontSize: size, lineHeight: 1.25 }}>Private baby monitoring</span>
          <strong>{size}</strong>
        </div>
      ))}
    </div>
  </section>
)

const BrandPage: React.FunctionComponent = () => (
  <main className="gallery-main">
    <GallerySection title="Colour Scales">
      <div className="colour-scale-grid">
        {colour_scales.map((scale) => (
          <ColourScaleCard key={scale.name} scale={scale} />
        ))}
      </div>
    </GallerySection>

    <GallerySection title="Typography">
      <div className="typography-grid">
        <Panel className="font-family-card">
          <p className="gallery-kicker">Font family</p>
          <h3>Inter</h3>
        </Panel>
        <Panel className="font-weight-card">
          <p className="gallery-kicker">Font weights</p>
          <div className="font-weight-list">
            {font_weights.map((weight) => (
              <div key={weight.name} className="font-weight-row">
                <span style={{ fontWeight: weight.value }}>The baby monitor stays at home.</span>
                <strong>{weight.name}</strong>
                <code>{weight.value}</code>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </GallerySection>

    <GallerySection title="Icons">
      <div className="brand-icon-grid">
        {brand_icons.map((icon) => (
          <BrandIconCard key={icon.name} name={icon.name} icon={icon.icon} style={icon.style} />
        ))}
      </div>
    </GallerySection>

    <GallerySection title="Scale">
      <Panel className="scale-card">
        <div className="scale-list">
          {scale_steps.map((step) => (
            <div key={step.index} className="scale-row">
              <strong>{step.index}</strong>
              <code>{step.value}</code>
              <span className="scale-measure" style={{ width: step.value }} />
            </div>
          ))}
        </div>
      </Panel>
    </GallerySection>
  </main>
)

const AliasPage: React.FunctionComponent = () => (
  <main className="gallery-main">
    <GallerySection title="Colour Categories">
      <div className="alias-colour-grid">
        {alias_colour_categories.map((category) => (
          <AliasColourCategoryCard
            key={category.token}
            name={category.name}
            source={category.source}
            token={category.token}
          />
        ))}
      </div>
    </GallerySection>

    <GallerySection title="Role Colour Categories">
      <div className="alias-colour-grid">
        {alias_role_colour_categories.map((category) => (
          <AliasColourCategoryCard
            key={category.token}
            name={category.name}
            source={category.source}
            token={category.token}
          />
        ))}
      </div>
    </GallerySection>

    <GallerySection title="Icon Usage">
      <div className="alias-icon-grid">
        {alias_icon_usages.map((item) => (
          <Panel key={item.name} className="alias-icon-card">
            <h3>{item.name}</h3>
            <p>{item.usage}</p>
          </Panel>
        ))}
      </div>
    </GallerySection>

    <GallerySection title="Borders">
      <div className="border-token-grid">
        {border_width_tokens.map(([label, token]) => (
          <BorderTokenCard key={token} label={`Width ${label}`} token={token} type="width" />
        ))}
        {border_radius_tokens.map(([label, token]) => (
          <BorderTokenCard key={token} label={`Radius ${label}`} token={token} type="radius" />
        ))}
      </div>
    </GallerySection>

  </main>
)

const MappedPage: React.FunctionComponent = () => (
  <main className="gallery-main">
    <GallerySection title="Mapped Surfaces">
      <div className="mapped-surface-grid">
        {mapped_surface_roles.map((surface) => (
          <MappedSurfaceCard key={surface.name} {...surface} />
        ))}
        <StarryNight seed="mapped-action-card" count={24} className="mapped-action-surface-card">
          <h3>Action</h3>
          <MappedActionButton />
        </StarryNight>
      </div>
    </GallerySection>

    <GallerySection title="Font Sizes">
      <div className="type-size-grid">
        <TypeSizeCard title="Desktop" sizes={desktop_type_sizes} />
        <TypeSizeCard title="Mobile" sizes={mobile_type_sizes} />
      </div>
    </GallerySection>

    <GallerySection title="Device Sizes">
      <div className="device-size-grid">
        {device_sizes.map((device_size) => (
          <DeviceSizeCard
            key={device_size.name}
            name={device_size.name}
            range={device_size.range}
            width={device_size.width}
          />
        ))}
      </div>
    </GallerySection>
  </main>
)

const ComponentsPage: React.FunctionComponent = () => (
  <main className="gallery-main">
    <GallerySection title="Buttons">
      <div className="component-row">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button loading>Loading</Button>
        <IconButton label="Camera"><Camera size={18} /></IconButton>
        <IconButton label="Notifications" variant="secondary"><Bell size={18} /></IconButton>
        <IconButton label="Settings" variant="ghost"><Settings size={18} /></IconButton>
      </div>
    </GallerySection>

    <GallerySection title="Forms">
      <div className="form-grid">
        <FormField label="Email address" html_for="email" hint="Use the email connected to your BeddyBytes account.">
          <TextInput id="email" placeholder="you@example.com" />
        </FormField>
        <FormField label="Password" html_for="password">
          <PasswordInput id="password" placeholder="Password" />
        </FormField>
        <FormField label="Station" html_for="station">
          <Select id="station" defaultValue="parent">
            <option value="parent">Parent Station</option>
            <option value="baby">Baby Station</option>
          </Select>
        </FormField>
        <FormField label="Station with icon" html_for="station-icon">
          <Select id="station-icon" defaultValue="baby" leading_icon={<FontAwesomeIcon icon={faBaby} />}>
            <option value="parent">Parent Station</option>
            <option value="baby">Baby Station</option>
          </Select>
        </FormField>
        <FormField label="Invalid field" html_for="invalid" error="Choose a different station name.">
          <TextInput id="invalid" invalid defaultValue="Nursery" />
        </FormField>
        <Checkbox label="Keep this device signed in" />
      </div>
    </GallerySection>

    <GallerySection title="Monitoring">
      <div className="component-row">
        <ConnectionStatusBadge label="Signal" value="MQTT" tone="connected" />
        <ConnectionStatusBadge label="Stream" value="live" tone="streaming" />
        <ConnectionStatusBadge label="Stream" value="waiting" tone="waiting" />
        <ConnectionStatusBadge label="Stream" value="idle" tone="idle" />
        <SessionTimer elapsed="0:00:34" />
        <VideoControls />
      </div>
    </GallerySection>

    <GallerySection title="Feedback">
      <div className="feedback-grid">
        <Alert tone="info" title="Local network only">BeddyBytes is built for monitoring around the house.</Alert>
        <Alert tone="success" title="Connected">The baby station is streaming to this device.</Alert>
        <Alert tone="warning" title="Low light">Video quality depends on the camera and browser.</Alert>
        <Alert tone="danger" title="Connection lost">Check that both devices are on the same network.</Alert>
      </div>
    </GallerySection>

    <GallerySection title="Surfaces">
      <div className="surface-grid">
        <Panel><strong>Default panel</strong><p>Useful for simple grouped controls.</p></Panel>
        <Panel tone="muted"><strong>Muted panel</strong><p>Lower-emphasis support content.</p></Panel>
        <Panel tone="raised"><strong>Raised panel</strong><p>Higher-emphasis grouped content.</p></Panel>
      </div>
      <StarrySky seed="gallery-starry-sky" count={130} className="starry-demo">
        <div>
          <Badge tone="action">Dark mode only</Badge>
          <h3>Deterministic star surface</h3>
          <p>Same seed and count render the same sky for screenshots and hydration.</p>
        </div>
      </StarrySky>
    </GallerySection>

  </main>
)

const DesignDocPage: React.FunctionComponent = () => {
  const { metadata, body } = split_design_doc(design_markdown)

  return (
    <main className="gallery-main">
      <GallerySection title="DESIGN.md">
        <div className="design-doc-grid">
          <article className="design-doc-body">
            {render_design_markdown(body)}
          </article>

          <aside className="design-doc-metadata">
            <h3>Metadata</h3>
            <pre>{metadata}</pre>
          </aside>
        </div>
      </GallerySection>
    </main>
  )
}

export const GalleryPages: React.FunctionComponent = () => {
  const initial_page = get_page_from_path(window.location.pathname)
  const is_embedded = is_embed_route(window.location.search)
  const [theme, set_theme_state] = React.useState<ThemeName>(() => (
    is_themed_page(initial_page) ? get_theme_from_search(window.location.search) : 'light'
  ))
  const [page, set_page_state] = React.useState<PageName>(initial_page)

  const set_route = React.useCallback((next_page: PageName, next_theme: ThemeName) => {
    window.history.pushState(null, '', get_route(next_page, next_theme))
  }, [])

  const set_page = React.useCallback((next_page: PageName) => {
    const next_theme = is_themed_page(next_page) ? theme : 'light'
    set_page_state(next_page)
    set_theme_state(next_theme)
    set_route(next_page, next_theme)
  }, [set_route, theme])

  const set_theme = React.useCallback((next_theme: ThemeName) => {
    set_theme_state(next_theme)
    set_route(page, next_theme)
  }, [page, set_route])

  React.useEffect(() => {
    const handle_popstate = () => {
      const next_page = get_page_from_path(window.location.pathname)
      set_page_state(next_page)
      set_theme_state(is_themed_page(next_page) ? get_theme_from_search(window.location.search) : 'light')
    }

    window.addEventListener('popstate', handle_popstate)
    return () => window.removeEventListener('popstate', handle_popstate)
  }, [])

  React.useEffect(() => {
    if (!is_themed_page(page)) {
      delete document.documentElement.dataset.theme
      return
    }

    document.documentElement.dataset.theme = theme
  }, [page, theme])

  if (is_embedded) {
    const content = <GalleryItemContent page={page} />

    if (is_themed_page(page) && theme === 'dark') {
      return (
        <StarryNight seed="gallery-page" count={100} className="gallery-item-document">
          {content}
        </StarryNight>
      )
    }

    return <div className="gallery-item-document">{content}</div>
  }

  const content = <GalleryShell page={page} theme={theme} set_page={set_page} set_theme={set_theme} />

  if (is_themed_page(page) && theme === 'dark') {
    return (
      <StarryNight seed="gallery-page" count={100} className="gallery-shell">
        {content}
      </StarryNight>
    )
  }

  return <div className="gallery-shell">{content}</div>
}
