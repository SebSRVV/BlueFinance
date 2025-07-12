'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import html2canvas from 'html2canvas'
import dayjs from 'dayjs'
import {
  FaUser, FaMoneyBillWave, FaCalendarAlt, FaCheckCircle, FaHourglassHalf
} from 'react-icons/fa'
import { supabase } from '@/lib/supabase'
import './deudas.css'

type Deuda = {
  id: string
  reason: string
  total_amount: number
  status: 'pending' | 'paid'
  created_at: string
  people: { name: string }
}

export default function ReporteDeudasPage() {
  const router = useRouter()
  const [deudas, setDeudas] = useState<Deuda[]>([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
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

      const { data, error } = await supabase
        .from('debts')
        .select(`
          id,
          reason,
          total_amount,
          status,
          created_at,
          people ( name )
        `)
        .eq('user_id', user_id)

      if (error) {
        console.error('Error al obtener deudas:', error.message)
        setDeudas([])
      } else if (Array.isArray(data)) {
        const normalizadas: Deuda[] = data.map((d: any) => ({
          id: d.id,
          reason: d.reason,
          total_amount: d.total_amount,
          status: d.status,
          created_at: d.created_at,
          people: Array.isArray(d.people)
            ? d.people[0] ?? { name: 'Desconocido' }
            : d.people ?? { name: 'Desconocido' }
        }))
        setDeudas(normalizadas)
      } else {
        setDeudas([])
      }

      setLoading(false)
    }

    fetchDeudas()
  }, [])

  const formatearFecha = (fecha: string) => dayjs(fecha).format('DD/MM/YYYY')

  const deudasFiltradas = filtro
    ? deudas.filter(d =>
        d.people?.name?.toLowerCase().includes(filtro.toLowerCase()) ||
        d.reason?.toLowerCase().includes(filtro.toLowerCase())
      )
    : deudas

  const agrupadas = deudasFiltradas.reduce<Record<string, Deuda[]>>((acc, deuda) => {
    const nombre = deuda.people?.name || 'Desconocido'
    if (!acc[nombre]) acc[nombre] = []
    acc[nombre].push(deuda)
    return acc
  }, {})

  const totalGlobal = deudasFiltradas.reduce((sum, d) => sum + d.total_amount, 0)

  const toggleSeleccion = (persona: string) => {
    setSeleccionadas(prev => {
      const nueva = new Set(prev)
      nueva.has(persona) ? nueva.delete(persona) : nueva.add(persona)
      return nueva
    })
  }

  const descargarImagen = async () => {
    if (!reporteRef.current) return

    const grupos = Array.from(reporteRef.current.querySelectorAll<HTMLElement>('[data-persona]'))
    const ocultos: HTMLElement[] = []

    for (const grupo of grupos) {
      const nombre = grupo.getAttribute('data-persona')
      if (!nombre || !seleccionadas.has(nombre)) {
        ocultos.push(grupo)
        grupo.style.display = 'none'
      }
    }

    const canvas = await html2canvas(reporteRef.current)
    const link = document.createElement('a')
    link.download = 'deudas_seleccionadas.png'
    link.href = canvas.toDataURL('image/png')
    link.click()

    ocultos.forEach(el => (el.style.display = ''))
  }

  const marcarUnaComoPagada = async (deuda: Deuda) => {
    const { data: sessionData } = await supabase.auth.getUser()
    const user_id = sessionData?.user?.id
    if (!user_id) return

    const { error: transError } = await supabase.from('transactions').insert({
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

    const { error: updateError } = await supabase
      .from('debts')
      .update({ status: 'paid' })
      .eq('id', deuda.id)

    if (!transError && !updateError) {
      setDeudas(prev =>
        prev.map(d => d.id === deuda.id ? { ...d, status: 'paid' } : d)
      )
    } else {
      alert('❌ Error al marcar como pagada')
    }
  }

  return (
    <main className="deudas-page">
      <button className="return-button" onClick={() => router.push('/dashboard')}>
        ⬅ Volver al Dashboard
      </button>

      <h1 className="dashboard-title">🧾 Reporte de Deudas</h1>

      <div className="form-card">
        <label>Filtrar por persona o motivo:</label>
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Ej: Juan, comida"
        />
      </div>

      <div ref={reporteRef} className="reporte-preview">
        {loading ? (
          <p>Cargando deudas...</p>
        ) : Object.keys(agrupadas).length === 0 ? (
          <p>No hay deudas registradas.</p>
        ) : (
          Object.entries(agrupadas).map(([persona, deudas]) => {
            const subtotal = deudas.reduce((sum, d) => sum + d.total_amount, 0)

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

                <ul>
                  {deudas.map(d => (
                    <li key={d.id}>
                      <div className="deuda-row">
                        <div className="deuda-info">
                          <strong>{d.reason || 'Sin motivo'}</strong>
                          <span>
                            <FaMoneyBillWave /> <b>S/{d.total_amount.toFixed(2)}</b>
                            <span className={`badge ${d.status === 'pending' ? 'badge-pending' : 'badge-paid'}`}>
                              {d.status === 'pending' ? (
                                <>
                                  <FaHourglassHalf /> Pendiente
                                </>
                              ) : (
                                <>
                                  <FaCheckCircle /> Pagada
                                </>
                              )}
                            </span>
                          </span>
                          <span className="fecha">
                            <FaCalendarAlt /> {formatearFecha(d.created_at)}
                          </span>
                        </div>

                        {d.status === 'pending' && (
                          <button
                            className="marcar-pagada-link"
                            onClick={() => marcarUnaComoPagada(d)}
                          >
                            Marcar como pagada
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="subtotal">Subtotal: S/{subtotal.toFixed(2)}</p>
              </div>
            )
          })
        )}
      </div>

      {seleccionadas.size > 0 && (
        <button className="export-button" onClick={descargarImagen}>
          📥 Descargar seleccionadas
        </button>
      )}

      {deudasFiltradas.length > 0 && (
        <div className="reporte-total">
          <h2>Total global: S/{totalGlobal.toFixed(2)}</h2>
        </div>
      )}
    </main>
  )
}
