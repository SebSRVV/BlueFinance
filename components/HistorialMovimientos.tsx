'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FaArrowDown, FaArrowUp, FaExclamation, FaMoneyBillWave,
  FaExchangeAlt, FaPen, FaTrash, FaUniversity, FaLeaf,
  FaLandmark, FaPiggyBank, FaCheck
} from 'react-icons/fa'
import '@/app/styles/Historial.css'

type Transaccion = {
  id: string
  type: string
  amount: number
  description: string
  category: string | null
  account_id: string
  destination_account_id: string | null
  created_at: string
  is_reconciled: boolean
}

type Cuenta = {
  id: string
  name: string
}

type Deuda = {
  id: string
  person: string
  reason: string
  total_amount: number
  status: 'pending' | 'paid'
  created_at: string
}

export default function HistorialMovimientos() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [deudas, setDeudas] = useState<Deuda[]>([])
  const [editando, setEditando] = useState<Transaccion | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const { data: trans } = await supabase.from('transactions').select('*')
      const { data: accs } = await supabase.from('accounts').select('*')
      const { data: debs } = await supabase.from('debts').select('*')

      setTransacciones((trans || []).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ))

      setCuentas(accs || [])
      setDeudas((debs || []).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ))
    }

    fetchData()
  }, [])

  const obtenerCuenta = (id: string | null) =>
    cuentas.find(c => c.id === id)

  const iconoPorTipo = (tipo: string) => {
    const iconClass = `icon tipo-${tipo}`
    switch (tipo) {
      case 'ingreso': return <FaArrowDown className={iconClass} />
      case 'gasto': return <FaArrowUp className={iconClass} />
      case 'deuda': return <FaExclamation className={iconClass} />
      case 'prestamo': return <FaMoneyBillWave className={iconClass} />
      case 'movimiento': return <FaExchangeAlt className={iconClass} />
      default: return null
    }
  }

  const iconoPorCuenta = (nombre: string) => {
    const lower = nombre.toLowerCase()
    if (lower.includes('bcp')) return <FaUniversity />
    if (lower.includes('lemon')) return <FaLeaf />
    if (lower.includes('interbank')) return <FaLandmark />
    if (lower.includes('ahorro')) return <FaPiggyBank />
    if (lower.includes('dinero')) return <FaMoneyBillWave />
    return <FaUniversity />
  }

  const capitalizar = (str: string) =>
    str.charAt(0).toUpperCase() + str.slice(1)

  const formatoMoneda = (valor: number) =>
    `S/${Number(valor).toFixed(2)}`

  const toggleConciliado = async (id: string, current: boolean) => {
    await supabase.from('transactions').update({ is_reconciled: !current }).eq('id', id)
    setTransacciones(prev =>
      prev.map(tx => tx.id === id ? { ...tx, is_reconciled: !current } : tx)
    )
  }

  const eliminarMovimiento = async (id: string) => {
    await supabase.from('transactions').delete().eq('id', id)
    setTransacciones(prev => prev.filter(tx => tx.id !== id))
  }

  const abrirEdicion = (tx: Transaccion) => {
    if (tx.type === 'movimiento') {
      alert('⚠️ No se puede editar una transferencia entre cuentas.')
      return
    }
    setEditando(tx)
    setEditDesc(tx.description)
    setEditAmount(tx.amount.toString())
  }

  const guardarCambios = async () => {
    if (!editando) return

    const nuevoMonto = parseFloat(editAmount)
    if (isNaN(nuevoMonto) || nuevoMonto <= 0) {
      alert('❌ Ingresa un monto válido')
      return
    }

    const { error } = await supabase
      .from('transactions')
      .update({
        description: editDesc,
        amount: nuevoMonto
      })
      .eq('id', editando.id)

    if (error) {
      alert('❌ Error al actualizar la transacción')
      return
    }

    setTransacciones(prev =>
      prev.map(tx =>
        tx.id === editando.id
          ? { ...tx, description: editDesc, amount: nuevoMonto }
          : tx
      )
    )

    setEditando(null)
  }

  const marcarDeudaComoPagada = async (deuda: Deuda) => {
    const { data: session } = await supabase.auth.getSession()
    const user_id = session?.session?.user.id
    if (!user_id) return

    const { error: err1 } = await supabase
      .from('debts')
      .update({ status: 'paid' })
      .eq('id', deuda.id)

    const { error: err2 } = await supabase
      .from('transactions')
      .insert({
        id: crypto.randomUUID(),
        user_id,
        type: 'ingreso',
        amount: deuda.total_amount,
        description: `Pago de deuda de ${deuda.person}`,
        category: 'Reembolso',
        created_at: new Date().toISOString(),
        account_id: '',
        destination_account_id: null,
        is_reconciled: false
      })

    if (!err1 && !err2) {
      setDeudas(prev => prev.map(d => d.id === deuda.id ? { ...d, status: 'paid' } : d))
      setTransacciones(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'ingreso',
        user_id,
        amount: deuda.total_amount,
        description: `Pago de deuda de ${deuda.person}`,
        category: 'Reembolso',
        account_id: '',
        destination_account_id: null,
        created_at: new Date().toISOString(),
        is_reconciled: false
      } as Transaccion])
    }
  }

  return (
    <div className="historial-notificaciones">
      <h2>📄 Historial de Movimientos</h2>

      {transacciones.map(tx => {
        const origen = obtenerCuenta(tx.account_id)
        const destino = obtenerCuenta(tx.destination_account_id)
        const esMovimiento = tx.type === 'movimiento'
        const esPositivo = ['ingreso', 'prestamo'].includes(tx.type)
        const montoClass = esPositivo ? 'ingreso' : 'negativo'
        const origenClass = origen?.name.toLowerCase().replace(/\s+/g, '') || ''
        const destinoClass = destino?.name.toLowerCase().replace(/\s+/g, '') || ''

        return (
          <div className={`tx-card ${tx.type}`} key={tx.id}>
            <div className="tx-left">
              <div className={`tx-icon ${tx.type}`}>
                {iconoPorTipo(tx.type)}
              </div>
              <div className="tx-info">
                <span className={`tx-type ${tx.type}`}>
                  {capitalizar(tx.type)}
                </span>
                <span className="tx-desc">
                  {tx.description} {tx.category && `| Categoría: ${tx.category}`}
                </span>
              </div>
            </div>

            <div className="tx-center">
              <span className="tx-date-centered">
                {new Date(tx.created_at).toLocaleDateString()}
              </span>

              {esMovimiento && origen && destino ? (
                <>
                  <div className="account-transfer">
                    <div className={`account-icon ${origenClass}`}>
                      {iconoPorCuenta(origen.name)}
                    </div>
                    <span className="arrow">→</span>
                    <div className={`account-icon ${destinoClass}`}>
                      {iconoPorCuenta(destino.name)}
                    </div>
                  </div>
                  <div className="account-name">
                    {origen.name.toUpperCase()} → {destino.name.toUpperCase()}
                  </div>
                  <div className={`tx-amount ${montoClass}`}>
                    - {formatoMoneda(tx.amount)}
                  </div>
                </>
              ) : (
                <>
                  {origen && (
                    <div className={`account-icon ${origenClass}`}>
                      {iconoPorCuenta(origen.name)}
                    </div>
                  )}
                  <div className="account-name">{origen?.name.toUpperCase()}</div>
                  <div className={`tx-amount ${tx.type}`}>
                    {esPositivo ? '+' : '-'} {formatoMoneda(tx.amount)}
                  </div>
                </>
              )}
            </div>

            <div className="tx-right">
              <span className={`tx-badge ${tx.is_reconciled ? 'ok' : 'no'}`}>
                {tx.is_reconciled ? 'Conciliado' : 'No conciliado'}
              </span>

              <label className="tx-switch">
                <input
                  type="checkbox"
                  checked={tx.is_reconciled}
                  onChange={() => toggleConciliado(tx.id, tx.is_reconciled)}
                />
                <span className="slider"></span>
              </label>

              {tx.type !== 'movimiento' && (
                <button className="tx-edit" onClick={() => abrirEdicion(tx)}>
                  <FaPen />
                </button>
              )}

              <button className="tx-edit" onClick={() => eliminarMovimiento(tx.id)}>
                <FaTrash />
              </button>
            </div>
          </div>
        )
      })}

      {/* Deudas pendientes */}
      {deudas.filter(d => d.status === 'pending').map(deuda => (
        <div className="tx-card deuda" key={deuda.id}>
          <div className="tx-left">
            <div className="tx-icon deuda">
              <FaExclamation />
            </div>
            <div className="tx-info">
              <span className="tx-type deuda">Deuda</span>
              <span className="tx-desc">{deuda.reason} — {deuda.person}</span>
            </div>
          </div>

          <div className="tx-center">
            <span className="tx-date-centered">
              {new Date(deuda.created_at).toLocaleDateString()}
            </span>
            <div className="account-name">Pendiente</div>
            <div className="tx-amount deuda">- {formatoMoneda(deuda.total_amount)}</div>
          </div>

          <div className="tx-right">
            <button className="tx-edit" onClick={() => marcarDeudaComoPagada(deuda)}>
              <FaCheck /> Marcar como pagada
            </button>
          </div>
        </div>
      ))}

      {/* Modal de edición */}
      {editando && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h3>✏️ Editar Movimiento</h3>
            <label>Descripción:</label>
            <input
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Descripción"
            />
            <label>Monto:</label>
            <input
              type="number"
              value={editAmount}
              onChange={e => setEditAmount(e.target.value)}
              placeholder="Monto"
            />
            <div className="popup-buttons">
              <button className="guardar" onClick={guardarCambios}>💾 Guardar</button>
              <button className="cancelar" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
