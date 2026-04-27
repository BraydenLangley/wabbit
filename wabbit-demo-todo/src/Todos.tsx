import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  PushDrop,
  Utils,
  Transaction,
  LockingScript,
  type BEEF,
  type WalletInterface,
  type WalletOutput,
  type WalletProtocol,
} from '@bsv/sdk'
import { useWabbit } from 'wabbit-react'

const TODO_PROTO_ADDR = '1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG'
const PROTOCOL_ID: WalletProtocol = [0, 'todo list']
const KEY_ID = '1'
const BASKET = 'todo tokens'
const DEFAULT_SATS = 1

type Task = {
  task: string
  sats: number
  outpoint: string
  lockingScript: string
  beef: BEEF | undefined
}

export const Todos = () => {
  const { wallet } = useWabbit()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newSats, setNewSats] = useState(DEFAULT_SATS)
  const [creating, setCreating] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadTasks = useCallback(async (w: WalletInterface) => {
    setLoading(true)
    setError(null)
    try {
      const outputs = await w.listOutputs({
        basket: BASKET,
        include: 'entire transactions',
        limit: 1000,
      })
      const decoded = await Promise.all(
        outputs.outputs.map(async (o: WalletOutput): Promise<Task | null> => {
          try {
            const txid = o.outpoint.split('.')[0]
            const idx = Number(o.outpoint.split('.')[1])
            const tx = Transaction.fromBEEF(outputs.BEEF as number[], txid)
            if (!tx) return null
            const lockingScript = tx.outputs[idx].lockingScript
            const decodedOut = PushDrop.decode(lockingScript)
            const encryptedTask = decodedOut.fields[1]
            const { plaintext } = await w.decrypt({
              ciphertext: encryptedTask,
              protocolID: PROTOCOL_ID,
              keyID: KEY_ID,
            })
            return {
              task: Utils.toUTF8(plaintext),
              sats: o.satoshis ?? 0,
              outpoint: o.outpoint,
              lockingScript: lockingScript.toHex(),
              beef: outputs.BEEF,
            }
          } catch (err) {
            console.error('Failed to decode task:', err)
            return null
          }
        })
      )
      setTasks(decoded.filter((t): t is Task => t !== null).reverse())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (wallet) loadTasks(wallet)
  }, [wallet, loadTasks])

  const createTask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!wallet || !newTask.trim()) return
    setCreating(true)
    setError(null)
    try {
      const { ciphertext } = await wallet.encrypt({
        plaintext: Utils.toArray(newTask, 'utf8'),
        protocolID: PROTOCOL_ID,
        keyID: KEY_ID,
      })
      const pushdrop = new PushDrop(wallet)
      const script = await pushdrop.lock(
        [Utils.toArray(TODO_PROTO_ADDR, 'utf8'), ciphertext],
        PROTOCOL_ID,
        KEY_ID,
        'self'
      )
      const result = await wallet.createAction({
        description: `Create a TODO task: ${newTask}`.slice(0, 128),
        outputs: [
          {
            lockingScript: script.toHex(),
            satoshis: Number(newSats),
            basket: BASKET,
            outputDescription: 'New ToDo list item',
          },
        ],
        options: { randomizeOutputs: false, acceptDelayedBroadcast: true },
      })
      setTasks(prev => [
        {
          task: newTask,
          sats: Number(newSats),
          outpoint: `${result.txid}.0`,
          lockingScript: script.toHex(),
          beef: result.tx,
        },
        ...prev,
      ])
      setNewTask('')
      setNewSats(DEFAULT_SATS)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const completeTask = async (t: Task) => {
    if (!wallet) return
    setCompleting(t.outpoint)
    setError(null)
    try {
      const description = `Complete a TODO task: "${t.task}"`.slice(0, 128)
      const { signableTransaction } = await wallet.createAction({
        description,
        inputBEEF: t.beef,
        inputs: [
          {
            inputDescription: 'Complete a ToDo list item',
            outpoint: t.outpoint,
            unlockingScriptLength: 73,
          },
        ],
        options: { acceptDelayedBroadcast: true, randomizeOutputs: false },
      })
      if (!signableTransaction) throw new Error('No signable transaction returned')
      const partialTx = Transaction.fromBEEF(signableTransaction.tx)
      const unlocker = new PushDrop(wallet).unlock(
        PROTOCOL_ID,
        KEY_ID,
        'self',
        'all',
        false,
        t.sats,
        LockingScript.fromHex(t.lockingScript)
      )
      const unlockingScript = await unlocker.sign(partialTx, 0)
      await wallet.signAction({
        reference: signableTransaction.reference,
        spends: { 0: { unlockingScript: unlockingScript.toHex() } },
      })
      setTasks(prev => prev.filter(x => x.outpoint !== t.outpoint))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCompleting(null)
    }
  }

  return (
    <>
      {error && <p className="error-banner">{error}</p>}

      <div className="card">
        <div className="card-section">
          <form onSubmit={createTask} className="composer">
            <input
              type="text"
              placeholder="What needs doing?"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              required
              autoFocus
            />
            <input
              type="number"
              min={1}
              value={newSats}
              onChange={e => setNewSats(Number(e.target.value))}
              title="sats to lock"
              className="sats-input"
            />
            <button type="submit" disabled={creating || !newTask.trim()}>
              {creating ? 'Adding…' : 'Add'}
            </button>
          </form>
        </div>

        <div className="list-header">
          <span className="count">
            {loading
              ? 'Loading…'
              : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
          </span>
          <span>locked as sats</span>
        </div>

        {loading && tasks.length === 0 && (
          <div className="loading-state">Loading tasks…</div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <p className="empty-title">Nothing to do</p>
            <p className="empty-subtitle">Add your first task above.</p>
          </div>
        )}

        {tasks.length > 0 && (
          <ul className="task-list">
            {tasks.map(t => (
              <li key={t.outpoint} className="task-item">
                <span className="task-text">{t.task}</span>
                <span className="sats-chip">{t.sats.toLocaleString()} sat</span>
                <button
                  className="complete-btn"
                  onClick={() => completeTask(t)}
                  disabled={completing === t.outpoint}
                >
                  {completing === t.outpoint ? 'Completing…' : 'Complete'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
