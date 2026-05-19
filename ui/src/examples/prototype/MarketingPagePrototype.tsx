import React from 'react'
import { Badge, Button, Panel } from '../../index'

export const MarketingPagePrototype: React.FunctionComponent = () => (
  <div className="rounded-xl border border-border bg-canvas text-text">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
      <strong className="text-lg">BeddyBytes</strong>
      <nav className="flex items-center gap-4 text-sm text-subdued">
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#privacy">Privacy</a>
      </nav>
    </header>

    <main className="grid gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <section>
        <Badge tone="success">No subscription</Badge>
        <h2 className="mb-4 mt-5 max-w-xl text-4xl font-bold leading-tight">
          A private baby monitor for devices you already own.
        </h2>
        <p className="max-w-xl text-lg text-subdued">
          BeddyBytes keeps video on your local network and works across phones, tablets, and laptops.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary">See pricing</Button>
          <Button variant="secondary">Check compatibility</Button>
        </div>
      </section>

      <Panel tone="raised" className="grid gap-4">
        <div className="aspect-video rounded-lg bg-muted" />
        <div>
          <h3 className="m-0 text-xl font-bold">Set up around the house</h3>
          <p className="mb-0 mt-2 text-subdued">
            Use one device as the baby station and another as the parent station.
          </p>
        </div>
      </Panel>
    </main>
  </div>
)
