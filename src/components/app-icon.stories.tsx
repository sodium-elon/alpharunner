import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { AppIcon, appIconNames } from './app-icon'
import { Button } from './ui/button'

const meta = {
  title: 'Design system/Phosphor icons',
  component: AppIcon,
  args: { name: 'overview', size: 24 },
  argTypes: {
    name: { control: 'select', options: appIconNames },
    size: { control: { type: 'range', min: 16, max: 48, step: 4 } },
  },
} satisfies Meta<typeof AppIcon>
export default meta
export const Playground: StoryObj<typeof meta> = {}
export const Catalog: StoryObj<typeof meta> = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
      {appIconNames.map((name) => (
        <div
          key={name}
          className="flex flex-col items-center gap-3 border border-border bg-card p-5"
        >
          <AppIcon name={name} size={28} />
          <span className="font-mono text-xs">{name}</span>
        </div>
      ))}
    </div>
  ),
}
export const Sizes: StoryObj<typeof meta> = {
  render: () => (
    <div className="flex items-end gap-8">
      {[16, 20, 24, 32, 48].map((size) => (
        <div key={size} className="flex flex-col items-center gap-4">
          <AppIcon name="calendar" size={size} />
          <span>{size}px</span>
        </div>
      ))}
    </div>
  ),
}
export const ColorSurfaces: StoryObj<typeof meta> = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[
        'bg-[#304ce8] text-white',
        'bg-[#ff785a] text-[#192334]',
        'bg-[#d0baff] text-[#192334]',
        'bg-[#d9fc53] text-[#192334]',
      ].map((color, index) => (
        <div className={`flex items-center gap-3 p-6 ${color}`} key={color}>
          <AppIcon
            name={(['run', 'heart', 'coaching', 'calendar'] as const)[index]!}
            size={24}
          />
          <span>With a label</span>
        </div>
      ))}
    </div>
  ),
}
export const ButtonsAndStates: StoryObj<typeof meta> = {
  render: function ButtonExamples() {
    const [selected, setSelected] = useState(false)
    return (
      <div className="flex flex-wrap gap-4">
        <Button className="min-h-11">
          <AppIcon name="history" />
          Run history
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          aria-pressed={selected}
          onClick={() => setSelected(!selected)}
        >
          <AppIcon name={selected ? 'check' : 'trends'} />
          {selected ? 'Trends selected' : 'Select trends'}
        </Button>
        <Button
          variant="outline"
          className="min-h-11 min-w-11"
          aria-label="Earlier week"
        >
          <AppIcon name="chevronLeft" />
        </Button>
        <Button
          variant="outline"
          className="min-h-11 min-w-11"
          aria-label="Later week"
          disabled
        >
          <AppIcon name="chevronRight" />
        </Button>
      </div>
    )
  },
}
export const AccessibleStandalone: StoryObj<typeof meta> = {
  args: { name: 'check', label: 'Training complete' },
}
