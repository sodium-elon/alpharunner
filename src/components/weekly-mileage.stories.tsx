import { useState } from 'react'
import { AppIcon } from '~/components/app-icon'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { WeeklyMileageCard } from './weekly-mileage'
import { summarizeWeeklyMileage } from '../lib/weekly-mileage'
const meta = {
  title: 'Training/Weekly mileage',
  component: WeeklyMileageCard,
} satisfies Meta<typeof WeeklyMileageCard>
export default meta
const runs = [
  { date: '2026-10-05', distanceKm: 8.4 },
  { date: '2026-10-07', distanceKm: 3.45 },
  { date: '2026-10-08', distanceKm: 10.71 },
  { date: '2026-10-10', distanceKm: 6.4 },
]
export const FullWeek: StoryObj<typeof meta> = {
  args: {
    mileage: summarizeWeeklyMileage(runs, new Date('2026-10-11T12:00:00Z')),
    dateLabel: '05 Oct – 11 Oct 2026',
    action: (
      <a href="#log" className="ar-week-link">
        Explore your training log <AppIcon name="open" size={18} />
      </a>
    ),
  },
}
export const Midweek: StoryObj<typeof meta> = {
  args: {
    ...FullWeek.args,
    mileage: summarizeWeeklyMileage(runs, new Date('2026-10-07T12:00:00Z')),
  },
}
export const EmptyWeek: StoryObj<typeof meta> = {
  args: {
    ...FullWeek.args,
    mileage: summarizeWeeklyMileage([], new Date('2026-10-05T12:00:00Z')),
  },
}
export const HighMileage: StoryObj<typeof meta> = {
  args: {
    ...FullWeek.args,
    mileage: summarizeWeeklyMileage(
      runs.map((run) => ({ ...run, distanceKm: run.distanceKm * 10 })),
      new Date('2026-10-11T12:00:00Z'),
    ),
  },
}

export const PeriodSelection: StoryObj<typeof meta> = {
  args: FullWeek.args,
  render: function PeriodSelectionStory(args) {
    const [period, setPeriod] = useState<'last7Days' | 'thisWeek'>('last7Days')
    const mileage = summarizeWeeklyMileage(runs, new Date('2026-10-12T12:00:00Z'), period)
    return <WeeklyMileageCard {...args} mileage={mileage} period={period} onPeriodChange={setPeriod} dateLabel={`${mileage.startDate} – ${mileage.endDate}`} />
  },
}
