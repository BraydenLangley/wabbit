import { useContext } from 'react'
import { WabbitContext, type WabbitContextValue } from './context'

/**
 * Access the wabbit hosted wallet from a component tree wrapped in <WabbitProvider>.
 *
 * Returns { ready, authenticated, wallet, login, logout, error }.
 * The `wallet` is a BRC-100 WalletInterface whose calls transparently route
 * through the cross-origin iframe — your site's JS never touches private keys.
 */
export const useWabbit = (): WabbitContextValue => {
  const ctx = useContext(WabbitContext)
  if (!ctx) {
    throw new Error(
      'useWabbit must be used inside <WabbitProvider>. ' +
        'Wrap your app with <WabbitProvider origin="..."> at the root.'
    )
  }
  return ctx
}
