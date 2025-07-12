'use client'

import { useRouter } from 'next/navigation'
import { FaFileImport, FaFileExport, FaExclamation } from 'react-icons/fa6'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import '@/app/styles/Acciones.css'

export default function Acciones({ onImportComplete }: { onImportComplete?: () => void }) {
  const router = useRouter()

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const { data: session } = await supabase.auth.getSession()
    const user_id = session?.session?.user.id
    if (!user_id) return alert('❌ Usuario no autenticado')

    const reader = new FileReader()
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet)

      let count = 0

      for (const row of rows as any[]) {
        const fecha = new Date(row['Fecha']).toISOString()
        const descripcion = row['Descripcion'] || 'Sin descripción'
        const ingreso = parseFloat(row['Ingreso']) || 0
        const egreso = parseFloat(row['Egreso']) || 0

        if (ingreso) {
          await supabase.from('transactions').insert({
            id: uuidv4(),
            user_id,
            type: 'ingreso',
            amount: ingreso,
            description: descripcion,
            category: 'Importado',
            created_at: fecha,
            date: fecha.slice(0, 10)
          })
          count++
        }

        if (egreso) {
          await supabase.from('transactions').insert({
            id: uuidv4(),
            user_id,
            type: 'gasto',
            amount: egreso,
            description: descripcion,
            category: 'Importado',
            created_at: fecha,
            date: fecha.slice(0, 10)
          })
          count++
        }
      }

      alert(`✅ ${count} movimientos importados`)
      onImportComplete?.()
    }

    reader.readAsArrayBuffer(file)
  }

  const exportToExcel = async () => {
    const { data: session } = await supabase.auth.getSession()
    const user_id = session?.session?.user.id
    if (!user_id) return alert('❌ Usuario no autenticado')

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user_id)

    const { data: debts, error: debtError } = await supabase
      .from('debts')
      .select('*, people (name)')
      .eq('user_id', user_id)

    if (txError || debtError) {
      return alert('❌ Error al cargar los datos')
    }

    const headers = ['Fecha', 'Descripción', 'Ingreso', 'Egreso', 'Cuenta', 'Deuda', 'Neto']
    const rows: any[] = []

    // Procesar transacciones
    transactions?.forEach(tx => {
      const ingreso = tx.type === 'ingreso' ? tx.amount : ''
      const egreso = tx.type === 'gasto' ? tx.amount : ''
      const neto = (tx.type === 'ingreso' ? tx.amount : 0) - (tx.type === 'gasto' ? tx.amount : 0)
      rows.push([
        new Date(tx.created_at).toLocaleDateString(),
        tx.description || '',
        ingreso,
        egreso,
        tx.category || '',
        '',
        neto
      ])
    })

    // Procesar deudas
    debts?.forEach(d => {
      const nombre = d.people?.name || d.person_id || 'Sin contacto'
      const monto = d.total_amount || 0
      rows.push([
        new Date(d.created_at).toLocaleDateString(),
        `${d.reason || 'Deuda'} - ${nombre}`,
        '',
        monto,
        '',
        '✔',
        -monto
      ])
    })

    // Totales
    const totalIngreso = transactions?.filter(tx => tx.type === 'ingreso')
      .reduce((sum, tx) => sum + tx.amount, 0) || 0

    const totalEgreso = transactions?.filter(tx => tx.type === 'gasto')
      .reduce((sum, tx) => sum + tx.amount, 0) || 0

    const totalDeuda = debts?.reduce((sum, d) => sum + (d.total_amount || 0), 0) || 0

    const totalNeto = totalIngreso - totalEgreso - totalDeuda

    rows.push([])
    rows.push(['Totales', '', totalIngreso, totalEgreso, '', totalDeuda, totalNeto])

    // Crear Excel
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    XLSX.writeFile(wb, 'Reporte_Movimientos.xlsx')
  }

  return (
    <div className="acciones-container">
      <h2>📂 Importar / Exportar</h2>
      <div className="acciones-botones">
        <label htmlFor="fileUpload" className="btn import">
          <FaFileImport /> Importar desde Excel
        </label>
        <input id="fileUpload" type="file" accept=".xlsx" onChange={handleImport} hidden />

        <button className="btn export" onClick={exportToExcel}>
          <FaFileExport /> Exportar a Excel
        </button>

        <button className="btn reporte" onClick={() => router.push('/deudas')}>
          <FaExclamation /> Generar reporte de deudas
        </button>
      </div>
    </div>
  )
}
