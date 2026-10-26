/**
 * A controllable stand-in for next/navigation.
 *
 * In a test file:
 *   jest.mock('next/navigation', () => require('@/test-utils/navigation').navigationMock)
 *   import { nav } from '@/test-utils/navigation'
 *   nav.pathname = '/student/courses'; nav.params = { courseId: '10' }
 *   expect(nav.router.push).toHaveBeenCalledWith('/login')
 */

export const nav = {
  pathname: '/',
  params: {} as Record<string, string>,
  search: new URLSearchParams(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  },
  /** Reset to a signed-out visitor on the home page. */
  reset() {
    nav.pathname = '/'
    nav.params = {}
    nav.search = new URLSearchParams()
    Object.values(nav.router).forEach((fn) => fn.mockReset())
  },
  setSearch(query: Record<string, string>) {
    nav.search = new URLSearchParams(query)
  },
}

export const navigationMock = {
  __esModule: true,
  usePathname: () => nav.pathname,
  useRouter: () => nav.router,
  useParams: () => nav.params,
  useSearchParams: () => nav.search,
  redirect: jest.fn(),
  notFound: jest.fn(),
}
