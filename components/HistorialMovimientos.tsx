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
  account_id: string | null
  destination_account_id: string | null
  created_at: string
  date?: string
  is_reconciled: boolean
}

type Cuenta = {
  id: string
  name: string
}

type Persona = {
  name: string
}

type Deuda = {
  id: string
  reason: string
  total_amount: number
  status: 'pending' | 'paid'
  category: string | null
  created_at: string
  person: Persona | null
}

type Movimiento =
  | (Transaccion & { _tipo: 'transaccion' })
  | (Deuda & { _tipo: 'deuda' })

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
      const { data: debs } = await supabase
        .from('debts')
        .select('*, person:people(name)')

      setTransacciones(trans || [])
      setDeudas(debs || [])
      setCuentas(accs || [])
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

  const cuentaClass = (nombre: string) =>
    nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '')

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
    const tx = transacciones.find(t => t.id === id)
    if (!tx) return

    // 1. Eliminar la transacción
    const { error: txError } = await supabase.from('transactions').delete().eq('id', id)

    // 2. Si era pago de deuda, revertir en deuda y eliminar payment
    const esPagoDeuda =
      tx.description?.toLowerCase().includes('pago deuda') ||
      tx.description?.toLowerCase().includes('pago parcial deuda')

    if (esPagoDeuda) {
      const deuda = deudas.find(d =>
        tx.description?.toLowerCase().includes(d.reason.toLowerCase())
      )

      if (deuda) {
        // Buscar y eliminar el payment correspondiente
        const { data: pagos } = await supabase
          .from('debt_payments')
          .select('*')
          .eq('debt_id', deuda.id)

        const pagoRelacionado = pagos?.find(p =>
          Math.abs(Number(p.amount) - tx.amount) < 0.01
        )

        if (pagoRelacionado) {
          await supabase.from('debt_payments').delete().eq('id', pagoRelacionado.id)
        }

        const nuevoTotal = deuda.total_amount + tx.amount

        await supabase
          .from('debts')
          .update({ total_amount: nuevoTotal, status: 'pending' })
          .eq('id', deuda.id)

        setDeudas(prev =>
          prev.map(d =>
            d.id === deuda.id
              ? { ...d, total_amount: nuevoTotal, status: 'pending' }
              : d
          )
        )
      }
    }

    setTransacciones(prev => prev.filter(t => t.id !== id))
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

    await supabase
      .from('debts')
      .update({ status: 'paid' })
      .eq('id', deuda.id)

    const { error } = await supabase.from('transactions').insert({
      user_id,
      type: 'ingreso',
      amount: deuda.total_amount,
      description: `Pago deuda: ${deuda.reason}`,
      category: 'Reembolso',
      created_at: new Date().toISOString(),
      account_id: null,
      destination_account_id: null,
      is_reconciled: false
    })

    await supabase.from('debt_payments').insert({
      user_id,
      debt_id: deuda.id,
      amount: deuda.total_amount,
      paid_at: new Date().toISOString(),
      note: 'Pago completo'
    })

    if (!error) {
      setDeudas(prev => prev.map(d => d.id === deuda.id ? { ...d, status: 'paid' } : d))
    }
  }

  const getFecha = (item: Movimiento): number => {
    return item._tipo === 'transaccion'
      ? new Date(item.date ?? item.created_at).getTime()
      : new Date(item.created_at).getTime()
  }

  const movimientos: Movimiento[] = [
    ...transacciones.map(tx => ({ ...tx, _tipo: 'transaccion' } as Movimiento)),
    ...deudas.map(d => ({ ...d, _tipo: 'deuda' } as Movimiento))
  ].sort((a, b) => getFecha(b) - getFecha(a))

  return (
    <div className="historial-notificaciones">
      <h2>📄 Historial de Movimientos</h2>

      {movimientos.map((item) => {
        if (item._tipo === 'transaccion') {
          const tx = item as Transaccion
          const origen = obtenerCuenta(tx.account_id)
          const destino = obtenerCuenta(tx.destination_account_id)
          const esMovimiento = tx.type === 'movimiento'
          const esPositivo = ['ingreso', 'prestamo'].includes(tx.type)
          const montoClass = esPositivo ? 'ingreso' : 'negativo'

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
                  {new Date(tx.date ?? tx.created_at).toLocaleDateString()}
                </span>

                {esMovimiento && origen && destino ? (
                  <>
                    <div className="account-transfer">
                      <div className={`account-icon ${cuentaClass(origen.name)}`}>
                        {iconoPorCuenta(origen.name)}
                      </div>
                      <span className="arrow">→</span>
                      <div className={`account-icon ${cuentaClass(destino.name)}`}>
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
                      <div className={`account-icon ${cuentaClass(origen.name)}`}>
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
        } else {
          const deuda = item as Deuda
          if (deuda.status === 'paid') return null

          return (
            <div className="tx-card deuda" key={deuda.id}>
              <div className="tx-left">
                <div className="tx-icon deuda">
                  <FaExclamation />
                </div>
                <div className="tx-info">
                  <span className="tx-type deuda">Deuda</span>
                  <span className="tx-desc">
                    {[deuda.reason, deuda.person?.name].filter(Boolean).join(' — ')}
                    {deuda.category && ` | Categoría: ${deuda.category}`}
                  </span>
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
          )
        }
      })}

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
