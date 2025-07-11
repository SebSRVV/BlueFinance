'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import './warda.css'
import { FaPiggyBank, FaBuildingColumns, FaArrowLeft } from 'react-icons/fa6'
import { useRouter } from 'next/navigation'

type Ward = {
  id: string
  name: string
}

type WardTransaction = {
  amount: number
  type: 'deposito' | 'retiro'
  description: string | null
}

type WardWithData = Ward & {
  balance: number
  movimientos: WardTransaction[]
}

export default function WardaPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [wards, setWards] = useState<WardWithData[]>([])
  const [wardName, setWardName] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editedName, setEditedName] = useState('')
  const [selectedWardId, setSelectedWardId] = useState('')
  const [monto, setMonto] = useState<number>(0)
  const [bcpAccountId, setBcpAccountId] = useState('')
  const [bcpBalance, setBcpBalance] = useState<number>(0)
  const [mensaje, setMensaje] = useState('')
  const [mensajeTipo, setMensajeTipo] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData?.user?.id
      if (!uid) return

      setUserId(uid)
      await fetchBCP(uid)
      await fetchWards(uid)
    }

    load()
  }, [])

  const fetchBCP = async (uid: string) => {
    const { data, error } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', uid)
      .eq('name', 'BCP')
      .single()

    if (error || !data) return
    setBcpAccountId(data.id)

    const { data: transacciones } = await supabase
      .from('transactions')
      .select('amount, type, account_id, destination_account_id')
      .eq('user_id', uid)

    const balance = (transacciones || []).reduce((acc, tx) => {
      const isBCP =
        tx.account_id === data.id || tx.destination_account_id === data.id

      if (!isBCP) return acc

      const isIngreso = tx.type === 'ingreso' && tx.account_id === data.id
      const isGasto = tx.type === 'gasto' && tx.account_id === data.id
      const isMovimientoSalida = tx.type === 'movimiento' && tx.account_id === data.id
      const isMovimientoEntrada = tx.type === 'movimiento' && tx.destination_account_id === data.id

      if (isIngreso || isMovimientoEntrada) return acc + Number(tx.amount)
      if (isGasto || isMovimientoSalida) return acc - Number(tx.amount)

      return acc
    }, 0)

    setBcpBalance(balance)
  }

  const fetchWards = async (uid: string) => {
    const { data: wardsData } = await supabase
      .from('wards')
      .select('id, name')
      .eq('user_id', uid)

    if (!wardsData) return

    const enriched = await Promise.all(
      wardsData.map(async (ward) => {
        const { data: transactions } = await supabase
          .from('ward_transactions')
          .select('amount, type, description')
          .eq('ward_id', ward.id)
          .order('created_at', { ascending: false })

        const balance = (transactions || []).reduce((acc, tx) =>
          tx.type === 'deposito' ? acc + Number(tx.amount) : acc - Number(tx.amount), 0)

        return {
          ...ward,
          balance,
          movimientos: transactions || []
        }
      })
    )

    setWards(enriched)
  }

  const crearWarda = async () => {
    if (!wardName.trim()) {
      mostrarMensaje('El nombre es obligatorio', 'error')
      return
    }

    if (wards.length >= 4) {
      mostrarMensaje('Máximo de 4 wardaditos alcanzado', 'error')
      return
    }

    await supabase.from('wards').insert({
      user_id: userId,
      account_id: bcpAccountId,
      name: wardName
    })

    setWardName('')
    mostrarMensaje('Warda creado exitosamente', 'success')
    fetchWards(userId)
  }

  const transferirAWarda = async () => {
    if (!selectedWardId || monto <= 0) {
      mostrarMensaje('Selecciona un wardadito y monto válido', 'error')
      return
    }

    if (monto > bcpBalance) {
      mostrarMensaje('Saldo insuficiente en BCP', 'error')
      return
    }

    await supabase.from('ward_transactions').insert({
      user_id: userId,
      ward_id: selectedWardId,
      amount: monto,
      type: 'deposito',
      description: 'Transferencia desde BCP'
    })

    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'movimiento',
      amount: monto,
      account_id: bcpAccountId,
      description: 'Aporte a wardadito'
    })

    setMonto(0)
    setSelectedWardId('')
    mostrarMensaje('Transferencia realizada ✅', 'success')
    fetchWards(userId)
    fetchBCP(userId)
  }

  const editarNombreWarda = (id: string, current: string) => {
    setEditingId(id)
    setEditedName(current)
  }

  const guardarNombreWarda = async (id: string) => {
    await supabase.from('wards').update({ name: editedName }).eq('id', id)
    setEditingId('')
    fetchWards(userId)
  }

const eliminarWarda = async (id: string) => {
  const confirmed = confirm('¿Eliminar este wardadito?')
  if (!confirmed) return

  const ward = wards.find(w => w.id === id)
  if (!ward) return

  const saldo = ward.balance

  if (saldo > 0) {
    // 1. Registrar el retiro en ward_transactions
    await supabase.from('ward_transactions').insert({
      user_id: userId,
      ward_id: id,
      amount: saldo,
      type: 'retiro',
      description: 'Reintegro a BCP por eliminación de warda'
    })

    // 2. Registrar ingreso en cuenta BCP
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'movimiento',
      amount: saldo,
      destination_account_id: bcpAccountId,
      description: 'Reintegro de warda eliminada'
    })
  }

  // 3. Eliminar el wardadito
  await supabase.from('wards').delete().eq('id', id)

  mostrarMensaje('Warda eliminado y saldo devuelto a BCP', 'success')
  fetchWards(userId)
  fetchBCP(userId)
}

  const mostrarMensaje = (msg: string, tipo: 'success' | 'error') => {
    setMensaje(msg)
    setMensajeTipo(tipo)
    setTimeout(() => {
      setMensaje('')
      setMensajeTipo('')
    }, 4000)
  }

  const total = wards.reduce((sum, w) => sum + w.balance, 0)

  return (
    <main className="warda-page">
      <button className="home-fab" onClick={() => router.push('/dashboard')}>
        <FaArrowLeft /> Volver al Dashboard
      </button>

      <h1 className="warda-title">🐷 Warda (Ahorros)</h1>

      <div className="ahorro-warda-largo">
        <div className="card-icon icon warda">
          <FaPiggyBank />
        </div>
        <div className="card-text">
          <p className="card-title">Ahorro Warda</p>
          <p className="card-value">S/{total.toFixed(2)}</p>
        </div>
        <div className="warda-inline-list">
          {wards.map((w) => (
            <div key={w.id} className="warda-item">
              <div className="warda-icon">
                <FaPiggyBank />
              </div>
              <div className="warda-info">
                <span className="warda-name">{w.name}</span>
                <span className="warda-amount">S/{w.balance.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {mensaje && <div className={`mensaje-feedback ${mensajeTipo}`}>{mensaje}</div>}

      <div className="contenido-principal">
        <div className="lado-izquierdo">
          <div className="bcp-card">
            <div className="card-icon icon bcp">
              <FaBuildingColumns />
            </div>
            <div className="card-text">
              <p className="card-title">BCP</p>
              <p className="card-value">S/{bcpBalance.toFixed(2)}</p>
            </div>
          </div>

          {wards.length < 4 && (
            <div className="warda-form">
              <input
                type="text"
                placeholder="Nombre del wardadito"
                value={wardName}
                onChange={(e) => setWardName(e.target.value)}
              />
              <button onClick={crearWarda}>Crear Warda</button>
            </div>
          )}

          <div className="transfer-form">
            <select value={selectedWardId} onChange={(e) => setSelectedWardId(e.target.value)}>
              <option value="">Selecciona un wardadito</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Monto desde BCP"
              value={monto}
              onChange={(e) => setMonto(parseFloat(e.target.value))}
            />
            <button onClick={transferirAWarda}>Transferir</button>
          </div>
        </div>

        <div className="lado-derecho">
          <div className="warda-lista">
            {wards.map((w) => (
              <div key={w.id} className="warda-item">
                <div className="header">
                  {editingId === w.id ? (
                    <>
                      <input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                      />
                      <button onClick={() => guardarNombreWarda(w.id)}>💾</button>
                    </>
                  ) : (
                    <>
                      <strong>{w.name}</strong>
                      <button onClick={() => editarNombreWarda(w.id, w.name)}>✏️</button>
                    </>
                  )}
                  <span className="text-blue-400 font-bold ml-2">S/{w.balance.toFixed(2)}</span>
                  <button onClick={() => eliminarWarda(w.id)} className="text-red-500 ml-4">🗑️</button>
                </div>

                <details className="historial">
                  <summary>📜 Ver historial</summary>
                  <ul>
                    {w.movimientos.map((m, i) => (
                      <li key={i}>
                        {m.type === 'deposito' ? '➕' : '➖'} S/{m.amount.toFixed(2)} — {m.description || 'Sin descripción'}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
