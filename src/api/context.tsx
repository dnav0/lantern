import React, { createContext, useContext } from 'react'
import type { BereanApi } from './types'

const ApiContext = createContext<BereanApi | null>(null)

export function ApiProvider({
  api,
  children
}: {
  api: BereanApi
  children: React.ReactNode
}): React.ReactElement {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}

// Access the BereanApi. Throws if used outside an ApiProvider so a missing
// provider fails loudly instead of silently returning undefined.
export function useApi(): BereanApi {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi must be used within an ApiProvider')
  return api
}
