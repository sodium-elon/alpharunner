import type { Meta, StoryObj } from '@storybook/react-vite'
import { BrandLogo, ShoeNameInline } from './shoe-name'

const meta = {
  title: 'Training/Shoe name',
  component: ShoeNameInline,
  args: { brand: 'Li-Ning', model: 'Red Hare 9', variant: 'Ultra' },
} satisfies Meta<typeof ShoeNameInline>
export default meta
export const Inline: StoryObj<typeof meta> = {}
export const Heading: StoryObj<typeof meta> = {
  args: { size: 'heading' },
  render: (args) => (
    <h1 className="ar-page-title">
      <ShoeNameInline {...args} />
    </h1>
  ),
}
export const WrappedHeading: StoryObj<typeof meta> = {
  args: { size: 'heading' },
  render: (args) => (
    <div className="max-w-sm">
      <h1 className="ar-page-title">
        <ShoeNameInline {...args} />
      </h1>
    </div>
  ),
}
export const RasterBrand: StoryObj<typeof meta> = {
  args: { brand: 'Qiaodan', model: 'Leili', variant: '2.0', size: 'heading' },
  render: (args) => (
    <h1 className="ar-page-title">
      <ShoeNameInline {...args} />
    </h1>
  ),
}
export const Fallback: StoryObj<typeof meta> = {
  args: {
    brand: 'New Brand',
    model: 'Daily runner',
    variant: null,
    size: 'heading',
  },
  render: (args) => (
    <h1 className="ar-page-title">
      <ShoeNameInline {...args} />
    </h1>
  ),
}
export const BrandSizes: StoryObj<typeof meta> = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
      {['Li-Ning', 'Nike', 'Adidas', 'Saucony', 'Qiaodan', 'New Brand'].map(
        (brand) => (
          <div key={brand} className="flex flex-col items-start gap-4">
            <span>{brand}</span>
            <BrandLogo brand={brand} />
            <span className="text-6xl">
              <BrandLogo brand={brand} size="heading" />
            </span>
          </div>
        ),
      )}
    </div>
  ),
}
