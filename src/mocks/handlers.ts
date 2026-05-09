import { http, HttpResponse } from 'msw'
import { mockDashboardData, getMockRunsOverview, getMockShoeDetail } from './data'

export const handlers = [
  http.get('*/api/dashboard', () => {
    return HttpResponse.json(mockDashboardData)
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
