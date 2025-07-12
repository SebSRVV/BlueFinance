'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import html2canvas from 'html2canvas'
import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import {
  FaUser,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaCheckCircle,
  FaHourglassHalf
} from 'react-icons/fa'
import './deudas.css'

type Deuda = {
  id: string
  reason: string
  total_amount: number
  status: 'pending' | 'paid'
  created_at: string
  people: {
    name: string
  } | null
}

export default function ReporteDeudasPage() {
  const router = useRouter()
  const [deudas, setDeudas] = useState<Deuda[]>([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)
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
          people (
            name
          )
        `) as unknown as { data: Deuda[] | null, error: any }

      if (error) {
        console.error('Error al obtener deudas:', error.message)
        setLoading(false)
        return
      }

      setDeudas(data || [])
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

  const total = deudasFiltradas.reduce((sum, d) => sum + d.total_amount, 0)

  const descargarImagen = async () => {
    if (reporteRef.current) {
      const canvas = await html2canvas(reporteRef.current)
      const link = document.createElement('a')
      link.download = 'reporte_deudas.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
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
          Object.entries(agrupadas).map(([persona, deudas]) => (
            <div key={persona} className="grupo-deuda">
              <h3><FaUser style={{ marginRight: 6 }} /> {persona}</h3>
              <ul>
                {deudas.map(d => (
                  <li key={d.id}>
                    <strong>{d.reason || 'Sin motivo'}</strong>
                    <span>
                      <FaMoneyBillWave />{' '}
                      <b>S/{d.total_amount.toFixed(2)}</b>
                      <span className={`badge ${d.status === 'pending' ? 'badge-pending' : 'badge-paid'}`}>
                        {d.status === 'pending' ? (
                          <>
                            <FaHourglassHalf style={{ marginRight: 4 }} />
                            Pendiente
                          </>
                        ) : (
                          <>
                            <FaCheckCircle style={{ marginRight: 4 }} />
                            Pagada
                          </>
                        )}
                      </span>
                    </span>
                    <span className="fecha">
                      <FaCalendarAlt style={{ marginRight: 4 }} />
                      {formatearFecha(d.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="subtotal">
                Subtotal: S/
                {deudas.reduce((sum, d) => sum + d.total_amount, 0).toFixed(2)}
              </p>
            </div>
          ))
        )}

        {deudasFiltradas.length > 0 && (
          <div className="reporte-total">
            <h2>Total global: S/{total.toFixed(2)}</h2>
          </div>
        )}
      </div>

      {deudasFiltradas.length > 0 && (
        <button className="export-button" onClick={descargarImagen}>
          📥 Descargar imagen
        </button>
      )}
    </main>
  )
}
