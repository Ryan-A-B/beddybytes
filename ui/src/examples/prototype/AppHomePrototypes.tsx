import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faDisplay, faGear, faMicrophone, faMoon, faPenToSquare, faPlay, faTag, faVideo, faWandMagicSparkles, faXmark } from '@fortawesome/free-solid-svg-icons'
import { ArrowRight, Play, Sparkles } from 'lucide-react'
import { Badge, Button, ConnectionStatusBadge, Panel, Select, SessionTimer, StarryNight, VideoControls } from '../../index'

type AppNavItem = 'Baby Station' | 'Parent Station'

const app_nav_items: AppNavItem[] = ['Baby Station', 'Parent Station']

const get_nav_active_classes = (item: AppNavItem): string => {
  if (item === 'Parent Station') {
    return 'bg-parent-action/70 text-parent-on-action'
  }

  return 'bg-baby-action/70 text-baby-on-action'
}

const AppPrototypeNavigation: React.FunctionComponent<{ active_item?: AppNavItem }> = ({ active_item }) => {
  const [is_open, set_is_open] = React.useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={is_open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={is_open}
        className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface/70 text-text sm:hidden"
        onClick={() => set_is_open((current) => !current)}
      >
        <FontAwesomeIcon icon={is_open ? faXmark : faBars} />
      </button>

      <nav className="hidden min-h-16 max-w-full overflow-hidden text-sm text-text/70 sm:grid sm:grid-cols-2">
        {app_nav_items.map((item) => (
          <button
            key={item}
            type="button"
            className={`grid min-w-40 place-items-center whitespace-nowrap px-8 py-4 transition ${active_item === item ? `font-semibold ${get_nav_active_classes(item)}` : 'hover:bg-surface hover:text-text'}`}
          >
            {item}
          </button>
        ))}
      </nav>

      {is_open ? (
        <nav className="absolute right-0 top-12 z-20 grid min-w-52 gap-1 rounded-lg border border-border bg-surface/95 p-2 text-sm shadow-[var(--shadow-lg)] backdrop-blur sm:hidden">
          {app_nav_items.map((item) => (
            <button
              key={item}
              type="button"
              className={`flex w-full items-center gap-2 rounded-md px-4 py-3 text-left transition ${active_item === item ? `font-semibold ${get_nav_active_classes(item)}` : 'text-text/80 hover:bg-surface hover:text-text'}`}
              onClick={() => set_is_open(false)}
            >
              {item}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  )
}

const AppPrototypeHeader: React.FunctionComponent<{ active_item?: AppNavItem }> = ({ active_item }) => (
  <header className="w-full">
    <div className="container mx-auto flex min-w-0 items-stretch gap-3 sm:gap-7">
      <a href="#home" className="flex items-center gap-3 text-text no-underline">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-action/25">
          <span className="h-3.5 w-3.5 rounded-full bg-white" />
        </span>
        <strong className="text-xl text-white">BeddyBytes</strong>
      </a>
      <AppPrototypeNavigation active_item={active_item} />
    </div>
  </header>
)

const AppPrototypeFooter: React.FunctionComponent = () => (
  <footer className="w-full border-t border-[rgb(var(--color-border)/var(--border-opacity-default,0.22))] pt-5 text-sm text-subdued">
    <div className="container mx-auto grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="grid max-w-sm gap-2">
        <strong className="text-xl font-medium text-text">BeddyBytes</strong>
        <p className="m-0 leading-relaxed">Designed and built with love by parents, for parents.</p>
      </div>
      <div className="grid gap-2 sm:min-w-[220px]">
        <strong className="text-xl font-semibold text-text">Build</strong>
        <dl className="m-0 grid gap-1">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-1">
            <dt>Date:</dt>
            <dd className="m-0 truncate">%REACT_APP_BUILD_DATE%</dd>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-1">
            <dt>Hash:</dt>
            <dd className="m-0 truncate">%REACT_APP_BUILD_HASH%</dd>
          </div>
        </dl>
      </div>
    </div>
  </footer>
)

export const AppHomePrototype: React.FunctionComponent = () => (
  <StarryNight seed="app-home-quiet-connection" count={100} className="min-h-screen bg-[var(--background-page)]">
    <div className="flex min-h-screen flex-col gap-8 pb-4 sm:gap-12 sm:pb-7">
      <AppPrototypeHeader />

      <main className="container mx-auto grid min-w-0 flex-1 gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.86fr)] lg:gap-10 lg:items-start">
        <div className="contents lg:order-2 lg:col-start-2 lg:grid lg:min-w-0 lg:content-start lg:gap-6">
          <div className="order-1 grid gap-3 sm:grid-cols-2 lg:order-2">
            <Button variant="baby-action" size="md" full_width>
              Open Baby Station <ArrowRight size={18} />
            </Button>
            <Button variant="parent-action" size="md" full_width>
              Open Parent Station <ArrowRight size={18} />
            </Button>
          </div>

          <div className="order-3 grid min-w-0 gap-4 lg:order-1">
            <div className="relative grid min-h-[220px] place-items-center overflow-hidden rounded-2xl bg-[var(--background-media)] sm:min-h-[290px]">
              <StarryNight seed="app-home-video-card" count={36} className="absolute inset-0" />
              <button type="button" className="grid h-16 w-16 place-items-center rounded-full border border-border bg-surface/80 text-text sm:h-20 sm:w-20">
                <Play size={34} fill="currentColor" />
              </button>
              <span className="absolute right-6 top-6 h-14 w-14 rounded-full bg-warning/40 sm:right-8 sm:top-8 sm:h-20 sm:w-20" />
              <div className="absolute bottom-4 left-5 flex items-center gap-3 text-sm">
                <Badge tone="neutral">2:14</Badge>
                <span>Setup in 60 seconds</span>
              </div>
              <span className="absolute bottom-5 right-5 hidden text-xs text-subdued sm:block">Tap to play</span>
            </div>
            <p className="m-0 text-center text-sm text-subdued">A quick walkthrough of pairing two devices.</p>
          </div>
        </div>

        <div className="contents lg:order-1 lg:col-start-1 lg:row-span-2 lg:grid lg:min-w-0 lg:content-start lg:gap-4">
          <section id="home" className="order-2 min-w-0 lg:order-none">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.28em] text-info">How to use BeddyBytes</p>
            </div>
            <h2 className="m-0 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
              Two devices. One quiet <span className="text-success">connection.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-subdued sm:text-lg">
              You'll need at least two devices: one as the <strong className="text-text">Baby Station</strong> and one or more as <strong className="text-text">Parent Stations</strong>. Both must be on the same Wi-Fi.
            </p>
          </section>

          <section className="order-4 grid min-w-0 gap-4 lg:order-none">
            <Panel className="grid gap-4 p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-[48px_minmax(0,1fr)]">
                <span className="grid h-12 w-12 place-items-center rounded-lg border border-baby-info/40 bg-baby-info/15 text-baby-info">
                  <FontAwesomeIcon icon={faMicrophone} />
                </span>
                <div>
                  <h3 className="m-0 text-xl font-bold">Baby Station</h3>
                  <ol className="mb-0 mt-3 grid gap-1 pl-5 text-subdued">
                    <li>Open this page on the device near the crib.</li>
                    <li>Go to Baby Station and allow microphone and optional camera.</li>
                    <li>Pick your devices, name the station, press Start.</li>
                  </ol>
                </div>
              </div>
            </Panel>

            <Panel className="grid gap-4 p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-[48px_minmax(0,1fr)]">
                <span className="grid h-12 w-12 place-items-center rounded-lg border border-parent-info/40 bg-parent-info/15 text-parent-info">
                  <FontAwesomeIcon icon={faDisplay} />
                </span>
                <div>
                  <h3 className="m-0 text-xl font-bold">Parent Station</h3>
                  <ol className="mb-0 mt-3 grid gap-1 pl-5 text-subdued">
                    <li>Open this page on another device on the same Wi-Fi.</li>
                    <li>Go to Parent Station; the dropdown will show active sessions.</li>
                    <li>Pick the station and listen in.</li>
                  </ol>
                </div>
              </div>
            </Panel>

            <Panel className="grid gap-3 p-5 text-sm text-subdued">
              <p className="m-0 flex gap-3"><Sparkles size={16} className="mt-0.5 shrink-0 text-warning" /> Stations won't appear in the parent dropdown until the baby station has started a session.</p>
              <p className="m-0 flex gap-3"><Sparkles size={16} className="mt-0.5 shrink-0 text-warning" /> Mute the parent device or keep it away from the baby's station to prevent audio feedback.</p>
              <p className="m-0 flex gap-3"><Sparkles size={16} className="mt-0.5 shrink-0 text-warning" /> Once connected, audio and video stream directly peer-to-peer. Devices on different networks won't connect.</p>
            </Panel>
          </section>
        </div>
      </main>
    </div>

    <div className="pb-4 sm:pb-7">
      <AppPrototypeFooter />
    </div>
  </StarryNight>
)

export const AppBabyStationStartPrototype: React.FunctionComponent = () => (
  <StarryNight seed="app-baby-station-ready" count={100} className="min-h-screen bg-[var(--background-page)]">
    <div className="flex min-h-screen flex-col gap-8 pb-4 sm:gap-12 sm:pb-7">
      <AppPrototypeHeader active_item="Baby Station" />

      <main className="container mx-auto grid flex-1 place-items-center py-8">
        <section className="relative grid w-full max-w-[480px] justify-items-center gap-6 overflow-hidden rounded-2xl border border-[rgb(var(--colour-role-baby-border)/var(--border-opacity-default,0.72))] bg-[var(--background-role-baby-panel)] px-6 py-10 text-center shadow-[var(--shadow-soft)] sm:px-10">
          <StarryNight seed="app-baby-station-ready-panel" count={32} className="absolute inset-0" />
          <div className="relative grid justify-items-center gap-6">
            <div className="relative grid h-20 w-20 place-items-center rounded-2xl border border-[rgb(var(--colour-role-baby-border)/0.46)] bg-[rgb(var(--colour-role-baby-surface)/0.44)] text-[rgb(var(--colour-role-baby-info))] shadow-[var(--shadow-soft)]">
              <FontAwesomeIcon icon={faMicrophone} className="text-3xl" />
              <FontAwesomeIcon icon={faWandMagicSparkles} className="absolute -right-2 top-1 text-xs text-[rgb(var(--colour-role-baby-action))]" />
            </div>

            <div className="grid max-w-sm gap-3">
              <h2 className="m-0 text-3xl font-bold leading-tight text-text">Ready to start?</h2>
              <p className="m-0 text-base leading-relaxed text-subdued">
                To use this device as a Baby Station, BeddyBytes needs access to your <span className="text-[rgb(var(--colour-role-baby-info))]">microphone</span> and <span className="text-[rgb(var(--colour-role-baby-info))]">camera</span>. Your browser will ask next.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[rgb(var(--color-border)/var(--border-opacity-default,0.72))] bg-[var(--background-default)] px-4 text-sm font-medium text-text">
                <FontAwesomeIcon icon={faMicrophone} />
                Microphone
              </span>
              <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[rgb(var(--color-border)/var(--border-opacity-default,0.72))] bg-[var(--background-default)] px-4 text-sm font-medium text-text">
                <FontAwesomeIcon icon={faVideo} />
                Camera
              </span>
            </div>

            <Button variant="baby-action" size="lg" full_width>
              Continue
            </Button>

            <p className="m-0 flex items-center justify-center gap-2 text-sm text-subdued">
              Nothing leaves your Wi-Fi. Promise.
              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xs text-[rgb(var(--colour-role-baby-info))]" />
            </p>
          </div>
        </section>
      </main>
    </div>

    <div className="pb-4 sm:pb-7">
      <AppPrototypeFooter />
    </div>
  </StarryNight>
)

export const AppBabyStationLivePrototype: React.FunctionComponent = () => {
  const [is_configuration_open, set_is_configuration_open] = React.useState(false)

  return (
    <StarryNight seed="app-baby-station-live" count={100} className="min-h-screen bg-[var(--background-page)]">
      <div className="flex min-h-screen flex-col gap-4 pb-4 sm:pb-7">
        <AppPrototypeHeader active_item="Baby Station" />

        <main
          className="container mx-auto grid min-h-0 flex-1 gap-4"
          style={{
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            gridTemplateAreas: '"configuration configuration" "video video" "start-button screensaver-button"',
          }}
        >
          <section
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-[rgb(var(--colour-role-baby-border)/var(--border-opacity-default,0.22))] bg-[var(--background-default)] px-4 py-4 sm:px-5"
            style={{ gridArea: 'configuration' }}
            aria-label="Baby station configuration"
          >
            <div className="min-w-0">
              <h2 className="m-0 flex min-w-0 items-center gap-2 text-base font-bold text-text sm:text-lg">
                <FontAwesomeIcon icon={faTag} className="shrink-0 text-[rgb(var(--colour-role-baby-info))]" />
                <span className="truncate">Little Bear</span>
              </h2>
              <p className="m-0 mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subdued">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <FontAwesomeIcon icon={faMicrophone} className="text-[rgb(var(--colour-icon-default))]" />
                  <span className="truncate">Default mic</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <FontAwesomeIcon icon={faVideo} className="text-[rgb(var(--colour-icon-default))]" />
                  <span className="truncate">Integrated_Webcam_FHD (V4L2)</span>
                </span>
              </p>
            </div>
            <button
              type="button"
              aria-label="Open baby station configuration"
              aria-expanded={is_configuration_open}
              className="p-3 border rounded-full text-secondary hover:text-secondary-hover"
              onClick={() => set_is_configuration_open(true)}
            >
              <FontAwesomeIcon icon={faGear} />
            </button>
          </section>

          <section
            className="min-h-[280px] min-w-0 overflow-hidden bg-black sm:min-h-[520px]"
            style={{ gridArea: 'video' }}
            aria-label="Baby station video preview"
          >
            <div className="h-full w-full bg-[radial-gradient(circle_at_center,rgb(255_255_255/0.035),transparent_42%),linear-gradient(180deg,rgb(0_0_0),rgb(0_0_0))]" />
          </section>

          <Button
            size="lg"
            full_width
            variant="baby-action"
          >
            <FontAwesomeIcon icon={faPlay} />
            Start
          </Button>
          <Button
            disabled
            size="lg"
            variant="secondary"
            full_width
          >
            <FontAwesomeIcon icon={faMoon} />
            Screen Saver
          </Button>
        </main>
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-30 transform rounded-t-2xl border-t border-[rgb(var(--colour-role-baby-border)/var(--border-opacity-default,0.22))] px-4 pb-6 pt-4 shadow-[var(--shadow-lg)] transition-transform duration-300 sm:px-6 ${is_configuration_open ? 'translate-y-0' : 'translate-y-full'
          }`}
        style={{ background: 'var(--background-page)' }}
        aria-hidden={!is_configuration_open}
      >
        <StarryNight seed="app-baby-station-configuration-sheet" count={42} className="pointer-events-none absolute inset-0 rounded-t-2xl" />
        <form className="container mx-auto relative grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 flex items-center gap-3 text-xl font-bold text-text">
              <FontAwesomeIcon icon={faTag} className="text-[rgb(var(--colour-role-baby-info))]" />
              Baby Station
            </h2>
            <button
              type="button"
              aria-label="Close baby station configuration"
              className="grid h-10 w-10 place-items-center rounded-lg text-subdued hover:text-text"
              onClick={() => set_is_configuration_open(false)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <label className="grid gap-2 text-sm text-subdued">
            Station Name
            <span className="grid grid-cols-[minmax(0,1fr)_40px] overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--input-background)]">
              <input className="min-h-10 min-w-0 bg-transparent px-3 text-sm text-text outline-none" defaultValue="Little Bear" />
              <button type="button" aria-label="Edit station name" className="grid place-items-center bg-[rgb(var(--colour-role-baby-surface)/0.34)] text-text">
                <FontAwesomeIcon icon={faPenToSquare} />
              </button>
            </span>
          </label>

          <fieldset className="m-0 grid gap-2 border-0 p-0 text-sm text-subdued">
            <legend className="mb-1 p-0">Devices</legend>
            <label className="grid gap-1">
              <span className="sr-only">Microphone</span>
              <Select
                defaultValue="default-microphone"
                leading_icon={<FontAwesomeIcon icon={faMicrophone} />}
              >
                <option value="default-microphone">Default microphone</option>
                <option value="usb-microphone">USB microphone</option>
              </Select>
            </label>
            <label className="grid gap-1">
              <span className="sr-only">Camera</span>
              <Select
                defaultValue="integrated-webcam"
                leading_icon={<FontAwesomeIcon icon={faVideo} />}
                menu_placement="top"
              >
                <option value="integrated-webcam">Integrated_Webcam_FHD (V4L2)</option>
                <option value="no-camera">No camera</option>
              </Select>
            </label>
          </fieldset>

          <Button
            variant="baby-action"
            type="button"
            size="lg"
            full_width
            onClick={() => set_is_configuration_open(false)}
          >
            Done
          </Button>
        </form>
      </div>

      {is_configuration_open ? (
        <button
          type="button"
          aria-label="Close configuration panel"
          className="fixed inset-0 z-20 cursor-default bg-black/20"
          onClick={() => set_is_configuration_open(false)}
        />
      ) : null}

      <div className="pb-4 sm:pb-7">
        <AppPrototypeFooter />
      </div>
    </StarryNight>
  )
}

export const AppParentStationPrototype: React.FunctionComponent = () => (
  <StarryNight seed="app-parent-station-waiting" count={100} className="min-h-screen bg-[var(--background-page)]">
    <div className="flex min-h-screen flex-col gap-8 pb-4 sm:gap-10 sm:pb-7">
      <AppPrototypeHeader active_item="Parent Station" />

      <main className="container mx-auto grid flex-1 place-items-center py-8">
        <section className="grid w-full max-w-3xl justify-items-center gap-9 text-center">
          <div className="inline-flex flex-wrap justify-center gap-2 rounded-full border border-input-border bg-surface p-1">
            <ConnectionStatusBadge label="Signal" value="MQTT" tone="connected" />
            <ConnectionStatusBadge label="Stream" value="waiting" tone="waiting" />
          </div>

          <div className="relative grid h-48 w-48 place-items-center sm:h-64 sm:w-64">
            <span className="absolute inset-0 rounded-full border border-parent-info/20" />
            <span className="absolute inset-4 rounded-full border border-parent-info/15" />
            <span className="absolute inset-8 rounded-full border border-parent-info/10" />
            <span className="absolute inset-12 rounded-full border border-parent-info/10" />
            <span
              className="absolute h-24 w-24 rounded-full shadow-[0_0_50px_color-mix(in_srgb,var(--color-warning-200)_18%,transparent)] sm:h-28 sm:w-28"
              style={{
                background: 'radial-gradient(circle at 32% 30%, var(--color-warning-100), var(--color-danger-200) 85%)',
              }}
            />
            <span className="absolute left-[38%] top-[42%] h-4 w-4 rounded-full bg-warning-300/30" />
            <span className="absolute left-[50%] top-[50%] h-3 w-3 rounded-full bg-danger-300/35" />
          </div>

          <div className="grid gap-4">
            <h2 className="m-0 text-4xl font-bold leading-tight text-text sm:text-5xl">
              No baby stations <span className="text-parent-info">yet.</span>
            </h2>
            <p className="m-0 max-w-xl text-lg leading-relaxed text-subdued">
              Open BeddyBytes on the device by the crib and press Start. It'll show up here within a few seconds.
            </p>
          </div>

          <SessionTimer elapsed="0:00:34" />
        </section>
      </main>
    </div>

    <div className="pb-4 sm:pb-7">
      <AppPrototypeFooter />
    </div>
  </StarryNight>
)

export const AppParentStationLivePrototype: React.FunctionComponent = () => (
  <StarryNight seed="app-parent-station-live" count={100} className="min-h-screen bg-[var(--background-page)]">
    <div className="flex min-h-screen flex-col gap-4 pb-4 sm:pb-7">
      <AppPrototypeHeader active_item="Parent Station" />

      <main className="container mx-auto grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 sm:gap-5">
        <section
          className="grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,360px)_minmax(0,1fr)_minmax(220px,360px)] lg:items-center"
          aria-label="Parent station connection"
        >
          <Select
            aria-label="Baby station"
            disabled
            defaultValue="nursery"
            leading_icon={<FontAwesomeIcon icon={faDisplay} />}
          >
            <option value="nursery">Nursery</option>
          </Select>

          <SessionTimer elapsed="0:00:34" className="lg:justify-self-center" />

          <div className="flex min-w-0 flex-wrap gap-2 lg:justify-end">
            <ConnectionStatusBadge label="Signal" value="MQTT" tone="connected" />
            <ConnectionStatusBadge label="Stream" value="live" tone="streaming" />
          </div>
        </section>

        <section className="relative min-h-[420px] min-w-0 overflow-hidden bg-black shadow-[var(--shadow-soft)] sm:min-h-[640px]" aria-label="Nursery live video">
          <div
            className="absolute inset-0"
            style={{
              background: [
                'radial-gradient(circle at 52% 46%, rgb(255 255 255 / 0.055), transparent 24%)',
                'radial-gradient(circle at 45% 60%, rgb(255 255 255 / 0.032), transparent 18%)',
                'linear-gradient(180deg, rgb(0 0 0), rgb(0 0 0))',
              ].join(', '),
            }}
          />
          <div className="absolute inset-x-0 bottom-0 grid justify-items-center bg-gradient-to-t from-black/80 via-black/28 to-transparent px-4 pb-4 pt-16">
            <VideoControls />
          </div>
        </section>
      </main>
    </div>

    <div className="pb-4 sm:pb-7">
      <AppPrototypeFooter />
    </div>
  </StarryNight>
)
