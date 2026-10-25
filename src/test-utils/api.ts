/**
 * Helpers for testing modules that call the shared axios client.
 *
 * In a test file:
 *   jest.mock('@/lib/api/client', () => require('@/test-utils/api').clientMock())
 *   import api from '@/lib/api/client'
 *   const http = api as unknown as MockClient
 */

export type MockClient = Record<
  'get' | 'post' | 'put' | 'patch' | 'delete',
  jest.Mock
>

export function clientMock() {
  return {
    __esModule: true,
    default: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
  }
}

/** A resolved axios-style response. */
export const reply = (data: unknown) => Promise.resolve({ data })

/** A rejected axios-style error with an HTTP status and body. */
export const httpError = (status: number, data: unknown = {}) =>
  Promise.reject(
    Object.assign(new Error(`Request failed with status code ${status}`), {
      response: { status, data },
    })
  )

/** An unsigned JWT with the given claims (enough for client-side decoding). */
export function fakeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.signature`
}
