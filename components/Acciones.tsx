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

    const reader = new FileReader()
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet)

      let count = 0

      for (const row of rows as any[]) {
        const fecha = new Date(row['Fecha']).toISOString()
        const descripcion = row['Descripcion']
        const ingreso = parseFloat(row['Ingreso']) || 0
        const egreso = parseFloat(row['Egreso']) || 0

        if (ingreso) {
          await supabase.from('wallet_transactions').insert({
            id: uuidv4(),
            type: 'income',
            amount: ingreso,
            descripcion,
            category: 'Importado',
            created_at: fecha
          })
          count++
        }

        if (egreso) {
          await supabase.from('wallet_transactions').insert({
            id: uuidv4(),
            type: 'expense',
            amount: egreso,
            descripcion,
            category: 'Importado',
            created_at: fecha
          })
          count++
        }
      }

      alert(`${count} registros importados`)
      onImportComplete?.()
    }

    reader.readAsArrayBuffer(file)
  }

  const exportToExcel = async () => {
    const { data: transactions } = await supabase.from('wallet_transactions').select('*')
    const { data: debts } = await supabase.from('debts').select('*')

    const headers = ['Fecha', 'Descripción', 'Ingreso', 'Egreso', 'Ahorro', 'Deuda', 'Neto']
    const rows: any[] = []

    transactions?.forEach(tx => {
      const isWarda = tx.description.toLowerCase().includes('warda')
      const ingreso = tx.type === 'income' ? tx.amount : 0
      const egreso = tx.type === 'expense' ? tx.amount : 0
      const neto = ingreso - egreso

      rows.push([
        new Date(tx.created_at).toLocaleDateString(),
        tx.description,
        ingreso || '',
        egreso || '',
        isWarda ? '✔' : '',
        '',
        neto
      ])
    })

    debts?.forEach(d => {
      rows.push([
        new Date(d.created_at).toLocaleDateString(),
        `${d.reason} - ${d.debtor_name}`,
        '',
        d.amount,
        '',
        '✔',
        -d.amount
      ])
    })

    const totalIngreso = transactions?.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0) || 0
    const totalEgreso = transactions?.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0) || 0
    const totalDeuda = debts?.reduce((sum, d) => sum + d.amount, 0) || 0
    const totalNeto = totalIngreso - totalEgreso - totalDeuda

    rows.push([])
    rows.push(['Totales', '', totalIngreso, totalEgreso, '', totalDeuda, totalNeto])

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
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
