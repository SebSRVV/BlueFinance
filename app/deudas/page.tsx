'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import html2canvas from 'html2canvas'
import { supabase } from '@/lib/supabase'
import './deudas.css'

type Debt = {
  id: string
  debtor_name: string
  amount: number
  reason: string
  status: 'pending' | 'paid'
  created_at: string
}

export default function ReporteDeudasPage() {
  const router = useRouter()
  const [deudas, setDeudas] = useState<Debt[]>([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const reporteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchDeudas = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('debts')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      setDeudas(data || [])
      setLoading(false)
    }

    fetchDeudas()
  }, [])

  const deudasFiltradas = filtro
    ? deudas.filter(d =>
        d.debtor_name.toLowerCase().includes(filtro.toLowerCase())
      )
    : deudas

  const agrupadas = deudasFiltradas.reduce<Record<string, Debt[]>>(
    (acc, deuda) => {
      if (!acc[deuda.debtor_name]) acc[deuda.debtor_name] = []
      acc[deuda.debtor_name].push(deuda)
      return acc
    },
    {}
  )

  const total = deudasFiltradas.reduce((sum, d) => sum + d.amount, 0)

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
    <main className="dashboard">
      <button className="return-button" onClick={() => router.push('/dashboard')}>
        ⬅ Volver al Dashboard
      </button>

      <h1 className="dashboard-title">🧾 Reporte de Deudas</h1>

      <div className="form-card">
        <label>Filtrar por persona:</label>
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Ej: Juan"
        />
      </div>

      <div ref={reporteRef} className="reporte-preview">
        {loading ? (
          <p>Cargando deudas...</p>
        ) : Object.keys(agrupadas).length === 0 ? (
          <p>No hay deudas pendientes.</p>
        ) : (
          Object.entries(agrupadas).map(([persona, items]) => (
            <div key={persona} className="reporte-persona">
              <h3>{persona}</h3>
              <ul>
                {items.map((d) => (
                  <li key={d.id}>
                    <span>
                      <strong>{d.reason}</strong>
                    </span>
                    <span>
                      — S/{d.amount.toFixed(2)}{' '}
                      <span className="fecha">
                        ({new Date(d.created_at).toLocaleDateString()})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="subtotal">
                Total: S/
                {items.reduce((sum, d) => sum + d.amount, 0).toFixed(2)}
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
