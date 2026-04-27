import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  PrivateKey,
  SHIPBroadcaster,
  Utils,
  LookupResolver,
  CachedKeyDeriver,
  type WalletInterface,
} from '@bsv/sdk'
import {
  Wallet,
  WalletStorageManager,
  WalletAuthenticationManager,
  WalletPermissionsManager,
  OverlayUMPTokenInteractor,
  WalletSigner,
  Services,
  StorageClient,
  TwilioPhoneInteractor,
  WABClient,
  PrivilegedKeyManager,
} from '@bsv/wallet-toolbox-client'
import { ADMIN_ORIGINATOR, CHAIN, IDLE_LOCK_MS, STORAGE_URL, WAB_URL } from './config'
import { entropyToMnemonic } from './keyMaterial'

type PasswordRetriever = (
  reason: string,
  test: (candidate: string) => boolean | Promise<boolean>
) => Promise<string>

export type PermissionRequest = {
  requestID: string
  type: 'protocol' | 'basket' | 'spending' | 'certificate'
  originator: string
  reason?: string
  protocolID?: unknown
  basket?: string
  spending?: { satoshis: number }
}

/**
 * A pending recovery-key save. The promise sent to the WAB manager will not
 * resolve until the UI calls `confirm()`. If the user bails, `abandon()` rejects.
 */
export type PendingRecoveryKey = {
  mnemonic: string
  bytes: number[]
  confirm: () => void
  abandon: () => void
}

type WalletCtx = {
  walletManager: WalletAuthenticationManager | null
  wallet: WalletInterface | null
  authenticated: boolean
  locked: boolean
  authFlow: 'new-user' | 'existing-user' | null
  providePassword: (pw: string) => Promise<void>
  pendingRequests: PermissionRequest[]
  pendingRecoveryKey: PendingRecoveryKey | null
  grantRequest: (requestID: string, ephemeral: boolean) => Promise<void>
  denyRequest: (requestID: string) => Promise<void>
  logout: () => void
  touch: () => void
  // Account-management helpers (require authenticated wallet)
  changePassword: (newPw: string) => Promise<void>
  getRecoveryMnemonic: () => Promise<string>
  regenerateRecoveryKey: () => Promise<void>
}

const WalletContext = createContext<WalletCtx | null>(null)

export const useWallet = () => {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}

const SNAPSHOT_KEY = 'wabbit.snap'

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [walletManager, setWalletManager] = useState<WalletAuthenticationManager | null>(null)
  const [wallet, setWallet] = useState<WalletInterface | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [locked, setLocked] = useState(false)
  const [authFlow, setAuthFlow] = useState<'new-user' | 'existing-user' | null>(null)
  const [pendingRequests, setPendingRequests] = useState<PermissionRequest[]>([])
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<PendingRecoveryKey | null>(null)

  const pendingPasswordResolver = useRef<((pw: string) => void) | null>(null)
  const permissionsManagerRef = useRef<WalletPermissionsManager | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const passwordRetriever: PasswordRetriever = useCallback(async () => {
    return new Promise<string>(resolve => {
      pendingPasswordResolver.current = resolve
    })
  }, [])

  /**
   * Saves the recovery key behind a UI gate. The returned Promise does not
   * resolve until the user clicks the confirmation button in RecoveryKeyModal.
   */
  const recoveryKeySaver = useCallback(
    (key: number[]): Promise<true> => {
      const mnemonic = entropyToMnemonic(key)
      return new Promise<true>((resolve, reject) => {
        setPendingRecoveryKey({
          mnemonic,
          bytes: key,
          confirm: () => {
            setPendingRecoveryKey(null)
            resolve(true)
          },
          abandon: () => {
            setPendingRecoveryKey(null)
            reject(new Error('User abandoned recovery key save'))
          },
        })
      })
    },
    []
  )

  const enqueueRequest = useCallback((req: PermissionRequest) => {
    setPendingRequests(prev =>
      prev.some(r => r.requestID === req.requestID) ? prev : [...prev, req]
    )
  }, [])

  const removeRequest = useCallback((requestID: string) => {
    setPendingRequests(prev => prev.filter(r => r.requestID !== requestID))
  }, [])

  const buildWallet = useCallback(
    async (primaryKey: number[], privilegedKeyManager: PrivilegedKeyManager) => {
      const keyDeriver = new CachedKeyDeriver(new PrivateKey(primaryKey))
      const storageManager = new WalletStorageManager(keyDeriver.identityKey)
      const signer = new WalletSigner(CHAIN, keyDeriver, storageManager)
      const services = new Services(CHAIN)
      const rawWallet = new Wallet(signer, services, undefined, privilegedKeyManager)

      const storageClient = new StorageClient(rawWallet, STORAGE_URL)
      await storageClient.makeAvailable()
      await storageManager.addWalletStorageProvider(storageClient)

      const permissionsManager = new WalletPermissionsManager(rawWallet, ADMIN_ORIGINATOR, {
        seekProtocolPermissionsForEncrypting: true,
        seekProtocolPermissionsForSigning: true,
        seekProtocolPermissionsForHMAC: false,
        seekBasketInsertionPermissions: true,
        seekBasketListingPermissions: true,
        seekBasketRemovalPermissions: true,
        seekSpendingPermissions: true,
        seekCertificateAcquisitionPermissions: true,
        seekCertificateDisclosurePermissions: true,
      })

      type IncomingRequest = {
        requestID: string
        type: PermissionRequest['type']
        originator: string
        reason?: string
        protocolID?: unknown
        basket?: string
        spending?: { satoshis: number }
      }
      permissionsManager.bindCallback('onProtocolPermissionRequested', (req: IncomingRequest) =>
        enqueueRequest({
          requestID: req.requestID,
          type: 'protocol',
          originator: req.originator,
          reason: req.reason,
          protocolID: req.protocolID,
        })
      )
      permissionsManager.bindCallback('onBasketAccessRequested', (req: IncomingRequest) =>
        enqueueRequest({
          requestID: req.requestID,
          type: 'basket',
          originator: req.originator,
          reason: req.reason,
          basket: req.basket,
        })
      )
      permissionsManager.bindCallback('onSpendingAuthorizationRequested', (req: IncomingRequest) =>
        enqueueRequest({
          requestID: req.requestID,
          type: 'spending',
          originator: req.originator,
          reason: req.reason,
          spending: req.spending ? { satoshis: req.spending.satoshis } : undefined,
        })
      )
      permissionsManager.bindCallback('onCertificateAccessRequested', (req: IncomingRequest) =>
        enqueueRequest({
          requestID: req.requestID,
          type: 'certificate',
          originator: req.originator,
          reason: req.reason,
        })
      )

      permissionsManagerRef.current = permissionsManager
      setWallet(permissionsManager as unknown as WalletInterface)
      return permissionsManager
    },
    [enqueueRequest]
  )

  // Build the authentication manager once
  useEffect(() => {
    if (walletManager) return

    const networkPreset = CHAIN === 'main' ? 'mainnet' : 'testnet'
    const resolver = new LookupResolver({ networkPreset })
    const broadcaster = new SHIPBroadcaster(['tm_users'], { networkPreset })

    const wabClient = new WABClient(WAB_URL)
    const phoneInteractor = new TwilioPhoneInteractor()

    const manager = new WalletAuthenticationManager(
      ADMIN_ORIGINATOR,
      buildWallet,
      new OverlayUMPTokenInteractor(resolver, broadcaster),
      recoveryKeySaver,
      passwordRetriever,
      wabClient,
      phoneInteractor
    )

    ;(window as unknown as { walletManager: unknown }).walletManager = manager
    setWalletManager(manager)

    const snap = localStorage.getItem(SNAPSHOT_KEY)
    if (snap) {
      manager.loadSnapshot(Utils.toArray(snap, 'base64')).catch(err => {
        console.warn('Failed to load snapshot, clearing:', err)
        localStorage.removeItem(SNAPSHOT_KEY)
      })
    }
  }, [walletManager, buildWallet, passwordRetriever, recoveryKeySaver])

  // Poll authenticated state & persist snapshot
  useEffect(() => {
    if (!walletManager) return
    const tick = () => {
      if (walletManager.authenticated && !authenticated) {
        setAuthenticated(true)
        setLocked(false)
        try {
          const snap = walletManager.saveSnapshot()
          localStorage.setItem(SNAPSHOT_KEY, Utils.toBase64(snap))
        } catch (err) {
          console.warn('Could not save snapshot:', err)
        }
      }
      const flow = (walletManager as unknown as { authenticationFlow?: 'new-user' | 'existing-user' })
        .authenticationFlow
      if (flow && flow !== authFlow) setAuthFlow(flow)
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [walletManager, authenticated, authFlow])

  const providePassword = useCallback(
    async (pw: string) => {
      if (!pendingPasswordResolver.current) {
        await walletManager?.providePassword(pw)
        return
      }
      const resolve = pendingPasswordResolver.current
      pendingPasswordResolver.current = null
      resolve(pw)
    },
    [walletManager]
  )

  const grantRequest = useCallback(
    async (requestID: string, ephemeral: boolean) => {
      removeRequest(requestID)
      await permissionsManagerRef.current?.grantPermission({ requestID, ephemeral })
    },
    [removeRequest]
  )

  const denyRequest = useCallback(
    async (requestID: string) => {
      removeRequest(requestID)
      await permissionsManagerRef.current?.denyPermission(requestID)
    },
    [removeRequest]
  )

  const touch = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SNAPSHOT_KEY)
    window.location.reload()
  }, [])

  // Idle lock
  useEffect(() => {
    if (!authenticated) return
    const activityEvents: Array<keyof DocumentEventMap> = ['click', 'keydown', 'mousemove', 'touchstart']
    const handler = () => {
      lastActivityRef.current = Date.now()
    }
    activityEvents.forEach(e => document.addEventListener(e, handler, { passive: true }))

    const id = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_LOCK_MS) {
        setLocked(true)
        pendingRequests.forEach(r => {
          permissionsManagerRef.current?.denyPermission(r.requestID).catch(() => {})
        })
        setPendingRequests([])
        window.location.reload()
      }
    }, 5_000)

    return () => {
      activityEvents.forEach(e => document.removeEventListener(e, handler))
      window.clearInterval(id)
    }
  }, [authenticated, pendingRequests])

  // Account-management helpers
  const changePassword = useCallback(
    async (newPw: string) => {
      if (!walletManager) throw new Error('Wallet not ready')
      await walletManager.changePassword(newPw)
      try {
        const snap = walletManager.saveSnapshot()
        localStorage.setItem(SNAPSHOT_KEY, Utils.toBase64(snap))
      } catch (err) {
        console.warn('Snapshot refresh after password change failed:', err)
      }
    },
    [walletManager]
  )

  const getRecoveryMnemonic = useCallback(async () => {
    if (!walletManager) throw new Error('Wallet not ready')
    const bytes = await walletManager.getRecoveryKey()
    return entropyToMnemonic(bytes)
  }, [walletManager])

  const regenerateRecoveryKey = useCallback(async () => {
    if (!walletManager) throw new Error('Wallet not ready')
    // changeRecoveryKey internally calls recoveryKeySaver with the new key,
    // which will pop the RecoveryKeyModal via pendingRecoveryKey state.
    await walletManager.changeRecoveryKey()
    try {
      const snap = walletManager.saveSnapshot()
      localStorage.setItem(SNAPSHOT_KEY, Utils.toBase64(snap))
    } catch (err) {
      console.warn('Snapshot refresh after recovery key change failed:', err)
    }
  }, [walletManager])

  const value = useMemo<WalletCtx>(
    () => ({
      walletManager,
      wallet,
      authenticated,
      locked,
      authFlow,
      providePassword,
      pendingRequests,
      pendingRecoveryKey,
      grantRequest,
      denyRequest,
      logout,
      touch,
      changePassword,
      getRecoveryMnemonic,
      regenerateRecoveryKey,
    }),
    [
      walletManager,
      wallet,
      authenticated,
      locked,
      authFlow,
      providePassword,
      pendingRequests,
      pendingRecoveryKey,
      grantRequest,
      denyRequest,
      logout,
      touch,
      changePassword,
      getRecoveryMnemonic,
      regenerateRecoveryKey,
    ]
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
