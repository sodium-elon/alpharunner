import { http, HttpResponse } from 'msw'
import { getMockDashboardData, getMockRunsOverview, getMockShoeDetail } from './data'

export const handlers = [
  http.get('*/api/dashboard', ({ request }) => {
    const url = new URL(request.url)
    const port = url.port || '3000'
    return HttpResponse.json(getMockDashboardData(port))
  }),
  http.get('*/api/runs', () => {
    return HttpResponse.json(getMockRunsOverview())
  }),
  http.get('*/api/shoes/:shoeId', ({ params }) => {
    try {
      return HttpResponse.json(getMockShoeDetail(params.shoeId as string))
    } catch {
      return HttpResponse.json({ error: 'Shoe not found' }, { status: 404 })
    }
  }),
]
