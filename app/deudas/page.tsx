'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import html2canvas from 'html2canvas'
import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import './deudas.css'

type Deuda = {
  id: string
  person: string
  reason: string
  total_amount: number
  status: 'pending' | 'paid'
  created_at: string
}

export default function ReporteDeudasPage() {
  const router = useRouter()
  const [deudas, setDeudas] = useState<Deuda[]>([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const reporteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchDeudas = async () => {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getUser()
      const user_id = sessionData?.user?.id

      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error al obtener deudas:', error.message)
      }

      setDeudas(data || [])
      setLoading(false)
    }

    fetchDeudas()
  }, [])

  const deudasFiltradas = filtro
    ? deudas.filter(d =>
        d.person?.toLowerCase().includes(filtro.toLowerCase()) ||
        d.reason?.toLowerCase().includes(filtro.toLowerCase())
      )
    : deudas

  const agrupadas = deudasFiltradas.reduce<Record<string, Deuda[]>>((acc, deuda) => {
    if (!acc[deuda.person]) acc[deuda.person] = []
    acc[deuda.person].push(deuda)
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

  const formatearFecha = (fecha: string) => dayjs(fecha).format('DD/MM/YYYY')

  return (
    <main className="dashboard">
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
          <p>No hay deudas pendientes.</p>
        ) : (
          Object.entries(agrupadas).map(([persona, deudas]) => (
            <div key={persona} className="grupo-deuda">
              <h3>{persona}</h3>
              <ul>
                {deudas.map(d => (
                  <li key={d.id}>
                    <strong>{d.reason || 'Sin motivo'}</strong> —{' '}
                    <span>Monto: S/{d.total_amount.toFixed(2)}</span> —{' '}
                    <span>Estado: {d.status === 'pending' ? 'Pendiente' : 'Pagada'}</span> —{' '}
                    <span className="fecha">Fecha: {formatearFecha(d.created_at)}</span>
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
