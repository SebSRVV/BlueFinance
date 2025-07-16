'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import {
  FaUser, FaMoneyBillWave, FaCalendarAlt, FaCheckCircle
} from 'react-icons/fa'
import { supabase } from '@/lib/supabase'
import './deudas.css'

type Pago = { amount: number; paid_at: string; note: string }

type Deuda = {
  id: string
  reason: string
  original_amount: number
  total_amount: number
  total_paid: number
  status: 'pending' | 'paid'
  created_at: string
  people: { name: string }
  payments: Pago[]
}

export default function ReporteDeudasPage() {
  const router = useRouter()
  const [deudas, setDeudas] = useState<Deuda[]>([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [pagarModal, setPagarModal] = useState<Deuda | null>(null)
  const [montoParcial, setMontoParcial] = useState('')
  const reporteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('deudas-activa')
    return () => document.body.classList.remove('deudas-activa')
  }, [])

  useEffect(() => {
    const fetchDeudas = async () => {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getUser()
      const user_id = sessionData?.user?.id
      if (!user_id) return

      const [{ data: deudasData }, { data: pagosData }] = await Promise.all([
        supabase.from('debts')
          .select('id, reason, total_amount, status, created_at, people(name)')
          .eq('user_id', user_id),
        supabase.from('debt_payments')
          .select('debt_id, amount, paid_at, note')
          .eq('user_id', user_id)
      ])

      const pagosPorDeuda = (pagosData || []).reduce<Record<string, Pago[]>>((acc, p: any) => {
        if (!acc[p.debt_id]) acc[p.debt_id] = []
        acc[p.debt_id].push({ amount: p.amount, paid_at: p.paid_at, note: p.note })
        return acc
      }, {})

      const normalizadas: Deuda[] = (deudasData || []).map((d: any) => {
        const pagos = pagosPorDeuda[d.id] || []
        const totalPaid = pagos.reduce((s, p) => s + p.amount, 0)
        const original = d.total_amount + totalPaid

        return {
          id: d.id,
          reason: d.reason,
          total_amount: d.total_amount,
          original_amount: original,
          total_paid: totalPaid,
          status: d.status,
          created_at: d.created_at,
          people: Array.isArray(d.people) ? d.people[0]! : d.people,
          payments: pagos
        }
      })

      setDeudas(normalizadas)
      setLoading(false)
    }

    fetchDeudas()
  }, [])

  const formatearFecha = (fecha: string) => dayjs(fecha).format('DD/MM/YYYY')

  const deudasFiltradas = filtro
    ? deudas.filter(d =>
        d.people.name.toLowerCase().includes(filtro.toLowerCase()) ||
        (d.reason || '').toLowerCase().includes(filtro.toLowerCase())
      )
    : deudas

  const pendientes = deudasFiltradas.filter(d => d.status === 'pending')
  const pagadas = deudasFiltradas.filter(d => d.status === 'paid')

  const agrupar = (arr: Deuda[]) =>
    arr.reduce<Record<string, Deuda[]>>((acc, d) => {
      const nombre = d.people.name
      if (!acc[nombre]) acc[nombre] = []
      acc[nombre].push(d)
      return acc
    }, {})

  const agrupadasPend = agrupar(pendientes)
  const agrupadasPag = agrupar(pagadas)
  const totalGlobal = pendientes.reduce((sum, d) => sum + d.total_amount, 0)

  const toggleSeleccion = (p: string) =>
    setSeleccionadas(prev => {
      const nueva = new Set(prev)
      nueva.has(p) ? nueva.delete(p) : nueva.add(p)
      return nueva
    })

  const exportarDatos = () => {
    if (seleccionadas.size === 0) {
      alert('Selecciona al menos una persona.')
      return
    }

    let contenido = `📄 Reporte de Deudas\n\n`

    seleccionadas.forEach(nombre => {
      const personaDeudas = deudas.filter(d => d.people.name === nombre && d.status === 'pending')
      if (personaDeudas.length === 0) return

      let subtotal = 0
      contenido += `👤 ${nombre}\n`

      personaDeudas.forEach(d => {
        subtotal += d.total_amount
        contenido += `- ${d.reason} | ${formatearFecha(d.created_at)} | Pendiente: S/${d.total_amount.toFixed(2)}\n`
      })

      contenido += `Total pendiente de ${nombre}: S/${subtotal.toFixed(2)}\n\n`
    })

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'reporte_deudas.txt'
    link.click()
  }

  const marcarPagada = async (deuda: Deuda, parcial = false) => {
    const monto = parcial ? parseFloat(montoParcial) : deuda.total_amount
    if (isNaN(monto) || monto <= 0 || monto > deuda.total_amount) {
      alert('Monto inválido')
      return
    }

    const { data: sessionData } = await supabase.auth.getUser()
    const user_id = sessionData?.user?.id
    if (!user_id) return

    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      supabase.from('transactions').insert({
        user_id,
        type: 'ingreso',
        amount: monto,
        description: `Pago deuda: ${deuda.reason}`,
        category: 'Reembolso',
        created_at: new Date().toISOString(),
        account_id: null,
        destination_account_id: null,
        is_reconciled: false
      }),
      supabase.from('debt_payments').insert({
        user_id,
        debt_id: deuda.id,
        amount: monto,
        note: parcial ? 'Pago parcial' : 'Pago total',
        paid_at: new Date().toISOString()
      }),
      supabase.from('debts')
        .update({
          total_amount: parcial ? deuda.total_amount - monto : 0,
          status: parcial && deuda.total_amount - monto > 0 ? 'pending' : 'paid'
        })
        .eq('id', deuda.id)
    ])

    if (e1 || e2 || e3) return alert('❌ Error al pagar')

    setDeudas(prev =>
      prev.map(d =>
        d.id === deuda.id
          ? {
              ...d,
              total_amount: parcial ? d.total_amount - monto : 0,
              total_paid: d.total_paid + monto,
              status: parcial && d.total_amount - monto > 0 ? 'pending' : 'paid',
              payments: [...d.payments, {
                amount: monto,
                paid_at: new Date().toISOString(),
                note: parcial ? 'Pago parcial' : 'Pago total'
              }]
            }
          : d
      )
    )

    setPagarModal(null)
    setMontoParcial('')
  }

  const eliminarDeuda = async (deudaId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta deuda? Esta acción no se puede deshacer.')) return

    const { data: sessionData } = await supabase.auth.getUser()
    const user_id = sessionData?.user?.id
    if (!user_id) return

    const { error: errorPagos } = await supabase
      .from('debt_payments')
      .delete()
      .eq('debt_id', deudaId)
      .eq('user_id', user_id)

    const { error: errorDeuda } = await supabase
      .from('debts')
      .delete()
      .eq('id', deudaId)
      .eq('user_id', user_id)

    if (errorPagos || errorDeuda) {
      alert('❌ Error al eliminar la deuda.')
      return
    }

    setDeudas(prev => prev.filter(d => d.id !== deudaId))
  }

  return (
    <main className="deudas-page">
      <div className="top-bar">
        <button className="volver-btn" onClick={() => router.push('/dashboard')}>
          ⬅ Volver al Dashboard
        </button>
        <h1 className="titulo-deudas centrado">🧾 Reporte de Deudas</h1>
      </div>

      <div className="form-card">
        <label>Filtrar:</label>
        <input
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          placeholder="nombre o motivo"
        />
      </div>

      <div ref={reporteRef} className="reporte-preview">
        {loading ? <p>Cargando...</p> : (
          <>
            {Object.entries(agrupadasPend).map(([persona, deudas]) => {
              const subtotal = deudas.reduce((s, d) => s + d.total_amount, 0)
              return (
                <div key={persona} className="grupo-deuda" data-persona={persona}>
                  <div className="grupo-header">
                    <label className="persona-checkbox">
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(persona)}
                        onChange={() => toggleSeleccion(persona)}
                      />
                      <FaUser /> {persona}
                    </label>
                  </div>

                  <div className="deudas-grid">
                    {deudas.map(deuda => (
                      <div key={deuda.id} className="deuda-card">
                        <div className="deuda-main">
                          <div className="deuda-header">
                            <strong>{deuda.reason}</strong>
                            <span className={`badge badge-${deuda.status}`}>
                              {deuda.status === 'paid' ? <><FaCheckCircle /> Pagada</> : 'Pendiente'}
                            </span>
                          </div>
                          <div className="deuda-detalles">
                            <span><FaMoneyBillWave /> Original: S/{deuda.original_amount.toFixed(2)}</span>
                            <span><FaCheckCircle /> Pagado: S/{deuda.total_paid.toFixed(2)}</span>
                            <span>⏳ Pendiente: S/{deuda.total_amount.toFixed(2)}</span>
                            <span><FaCalendarAlt /> {formatearFecha(deuda.created_at)}</span>
                          </div>
                        </div>
                        <div className="deuda-acciones">
                          <button onClick={() => marcarPagada(deuda, false)}>Pago Completo</button>
                          <button onClick={() => setPagarModal(deuda)}>Pago Parcial</button>
                          <button onClick={() => eliminarDeuda(deuda.id)} className="eliminar-btn">🗑 Eliminar</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="subtotal">Subtotal: S/{subtotal.toFixed(2)}</p>
                </div>
              )
            })}

            {Object.entries(agrupadasPag).length > 0 && (
              <div className="seccion-pagadas">
                <h2>✅ Deudas Pagadas</h2>
                {Object.entries(agrupadasPag).map(([persona, deudas]) => {
                  const subtotal = deudas.reduce((s, d) => s + d.original_amount, 0)
                  return (
                    <div key={persona} className="grupo-deuda pagadas" data-persona={persona}>
                      <div className="grupo-header">
                        <FaUser /> {persona}
                      </div>
                      <div className="deudas-grid">
                        {deudas.map(deuda => (
                          <div key={deuda.id} className="deuda-card">
                            <div className="deuda-main">
                              <div className="deuda-header">
                                <strong>{deuda.reason}</strong>
                                <span className="badge badge-paid"><FaCheckCircle /> Pagada</span>
                              </div>
                              <div className="deuda-detalles">
                                <span><FaMoneyBillWave /> Original: S/{deuda.original_amount.toFixed(2)}</span>
                                <span><FaCheckCircle /> Pagado: S/{deuda.total_paid.toFixed(2)}</span>
                                <span><FaCalendarAlt /> {formatearFecha(deuda.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="subtotal">Subtotal: S/{subtotal.toFixed(2)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="acciones-finales">
        {seleccionadas.size > 0 && (
          <button onClick={exportarDatos} className="export-button">
            📥 Exportar
          </button>
        )}
        {pendientes.length > 0 && (
          <div className="reporte-total">
            <h2>Total pendiente: S/{totalGlobal.toFixed(2)}</h2>
          </div>
        )}
      </div>

      {pagarModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Pago Parcial</h3>
            <p>Motivo: <strong>{pagarModal.reason}</strong></p>
            <p>Monto actual: <strong>S/{pagarModal.total_amount.toFixed(2)}</strong></p>
            <input
              type="number"
              placeholder="Monto a pagar"
              value={montoParcial}
              onChange={e => setMontoParcial(e.target.value)}
            />
            <div className="modal-buttons">
              <button onClick={() => marcarPagada(pagarModal, true)}>Confirmar</button>
              <button onClick={() => setPagarModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
