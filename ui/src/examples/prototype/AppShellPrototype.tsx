import React from 'react'
import { Baby, Monitor, Moon, Wifi } from 'lucide-react'
import { Alert, Badge, Button, IconButton, Panel, StarrySky } from '../../index'

export const AppShellPrototype: React.FunctionComponent = () => (
  <div data-theme="dark" className="min-h-[620px] overflow-hidden rounded-xl border border-border bg-canvas">
    <StarrySky seed="app-shell-prototype" count={150} className="min-h-[620px]">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="m-0 text-sm text-subdued">BeddyBytes</p>
          <h2 className="m-0 text-xl font-bold leading-tight">Parent Station</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="success">Connected</Badge>
          <IconButton label="Night mode">
            <Moon size={18} />
          </IconButton>
        </div>
      </header>

      <main className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]">
        <Panel tone="raised" className="min-h-[340px]">
          <div className="flex h-full min-h-[292px] items-center justify-center rounded-lg border border-white/10 bg-black/30">
            <div className="text-center">
              <Baby className="mx-auto mb-3 text-action" size={42} />
              <p className="m-0 text-lg font-semibold">Video preview area</p>
              <p className="m-0 text-sm text-subdued">Camera stream sits here in the app.</p>
            </div>
          </div>
        </Panel>

        <div className="grid gap-4">
          <Panel tone="default">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-lg font-bold">Session</h3>
              <Badge tone="action">12:42</Badge>
            </div>
            <div className="grid gap-3">
              <Button full_width>Start monitoring</Button>
              <Button variant="secondary" full_width>Switch station</Button>
            </div>
          </Panel>

          <Alert tone="info" title="Same home network">
            Video stays on devices connected around the house.
          </Alert>

          <Panel tone="muted" className="grid gap-3">
            <div className="flex items-center gap-3">
              <Monitor size={20} className="text-action" />
              <span className="font-semibold">Laptop display</span>
            </div>
            <div className="flex items-center gap-3">
              <Wifi size={20} className="text-success" />
              <span className="font-semibold">Local network ready</span>
            </div>
          </Panel>
        </div>
      </main>
    </StarrySky>
  </div>
)
