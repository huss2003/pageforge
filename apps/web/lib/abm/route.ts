import { errorResponse } from './http'

/** Shared Route Handler settings for /api/abm/*. */
export type Ctx<P extends Record<string, string> = { id: string }> = { params: Promise<P> }

/** Wrap a handler so thrown AbmErrors become JSON problems and anything else a redacted 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args)
    } catch (e) {
      return errorResponse(e)
    }
  }
}
