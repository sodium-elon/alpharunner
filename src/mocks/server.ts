import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { mockDashboardData } from './dashboard'

const handlers = [
  http.get('http://localhost/_mock/dashboard', () => {
    return HttpResponse.json(mockDashboardData)
  }),
]

export const mockServer = setupServer(...handlers)
