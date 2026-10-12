import { AppIcon } from '~/components/app-icon'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import {
  DetailDisclosure,
  EquipmentCard,
  Metric,
  PageIntro,
  SectionHeading,
  SessionSpotlight,
  ViewSwitch,
} from './training-ui'

const meta = {
  title: 'Training/Page intro',
  component: PageIntro,
} satisfies Meta<typeof PageIntro>
export default meta
export const Overview: StoryObj<typeof meta> = {
  args: {
    eyebrow: 'Your training headquarters',
    title: (
      <>
        Every run.
        <br />
        All you.
      </>
    ),
    description: 'Welcome back, John. Your progress, from the ground up.',
    action: (
      <a className="ar-cta" href="#runs">
        Explore your runs <AppIcon name="open" size={18} />
      </a>
    ),
  },
}
export const LongTitle: StoryObj<typeof meta> = {
  args: {
    eyebrow: 'Your rotation / Shoe performance',
    title: 'Deviate Nitro Elite 3',
    description: 'race • active • carbon plated',
  },
}

export const Metrics = {
  render: () => (
    <div className="ar-metric-strip">
      <Metric
        label="Total distance"
        value="1,284.72 km"
        helper="Every kilometre counts"
      />
      <Metric label="Runs logged" value="124" helper="Your training to date" />
      <Metric label="Average pace" value="—" helper="No runs yet" />
    </div>
  ),
}
export const Section = {
  render: () => (
    <SectionHeading
      number="01"
      title="Fresh off the track"
      description="Your latest sessions."
      action={
        <a className="ar-back-link" href="#runs">
          All runs <AppIcon name="open" size={18} />
        </a>
      }
    />
  ),
}
export const LatestSession = {
  render: () => (
    <SessionSpotlight
      date="2026-10-10"
      activity="easy"
      distance="8.42"
      pace="5:32/km"
      duration="46m 35s"
      action={
        <a className="ar-cta ar-cta-light" href="#session">
          Explore session <AppIcon name="open" size={18} />
        </a>
      }
    >
      <p className="ar-spotlight-note">
        Keep the next session easy and controlled.
      </p>
    </SessionSpotlight>
  ),
}
export const SessionWithoutCoaching = {
  render: () => (
    <SessionSpotlight
      date="2026-10-10"
      activity="unknown"
      distance="5.00"
      pace="6:02/km"
      duration="30m 10s"
      action={
        <a className="ar-cta ar-cta-light" href="#session">
          Explore session <AppIcon name="open" size={18} />
        </a>
      }
    />
  ),
}
export const Shoe = {
  render: () => (
    <div className="max-w-sm">
      <EquipmentCard
        name="Puma Deviate Nitro 3"
        role="daily"
        status="active"
        distance="248.5"
        stats={[
          { label: 'Runs', value: '32' },
          { label: 'Avg pace', value: '5:32/km' },
          { label: 'Cadence', value: '172 spm' },
          { label: 'Avg HR', value: '142 bpm' },
        ]}
        action={<a href="#shoe">Explore shoe performance</a>}
      />
    </div>
  ),
}
export const ShoeWithoutRuns = {
  render: () => (
    <div className="max-w-sm">
      <EquipmentCard
        name="A new pair"
        role="unknown"
        status="testing"
        distance="0.0"
        stats={[
          { label: 'Runs', value: '0' },
          { label: 'Avg pace', value: '—' },
          { label: 'Cadence', value: '—' },
          { label: 'Avg HR', value: '—' },
        ]}
        action={<a href="#shoe">Explore shoe performance</a>}
      />
    </div>
  ),
}
export const CollapsedDetails = {
  render: () => (
    <DetailDisclosure
      title="Running dynamics & equipment"
      description="Cadence, power, stride and shoes"
    >
      <Metric label="Cadence" value="172 spm" />
    </DetailDisclosure>
  ),
}
export const ExpandedDetails = {
  render: () => (
    <DetailDisclosure title="Training data coverage" defaultOpen>
      <Metric label="Coaching notes" value="28" />
    </DetailDisclosure>
  ),
}
export const SwitchViews = {
  render: function SwitchStory() {
    const [value, setValue] = useState<'history' | 'trends'>('history')
    return (
      <>
        <ViewSwitch value={value} onValueChange={setValue} />
        <p className="p-6">
          {value === 'history'
            ? 'Run history content'
            : 'Performance trend content'}
        </p>
      </>
    )
  },
}
