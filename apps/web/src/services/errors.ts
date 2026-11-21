export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))
