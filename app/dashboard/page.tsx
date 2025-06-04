'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import {
  FaArrowDown, FaArrowUp, FaDollarSign, FaExclamation,
  FaFileExport, FaFileImport, FaHouse
} from 'react-icons/fa6'
import * as XLSX from 'xlsx'
import './Dashboard.css'

type Transaction = {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  created_at: string
}

type Debt = {
  id: string
  debtor_name: string
  amount: number
  reason: string
  status: 'pending' | 'paid'
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [newEntry, setNewEntry] = useState({
    type: 'income',
    amount: '',
    description: '',
    person: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [selectedType, setSelectedType] = useState<'transaction' | 'debt' | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editAmount, setEditAmount] = useState('')

  const openPopup = (item: any, type: 'transaction' | 'debt') => {
    setSelectedItem(item)
    setSelectedType(type)
    setEditDescription(item.description || item.reason)
    setEditAmount(item.amount.toString())
  }

  const closePopup = () => {
    setSelectedItem(null)
    setSelectedType(null)
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const { data: txData } = await supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false })
      const { data: debtData } = await supabase.from('debts').select('*').order('created_at', { ascending: false })

      setTransactions(txData || [])
      setDebts(debtData || [])
    } catch {
      showMessage('error', 'Error al cargar los datos')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const totalIncome = useMemo(() =>
    transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0), [transactions])

  const totalExpense = useMemo(() =>
    transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0), [transactions])

  const pendingDebt = useMemo(() =>
    debts.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0), [debts])

  const totalWarda = useMemo(() =>
    transactions
      .filter(t => t.description.toLowerCase().includes('warda'))
      .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0), [transactions])

  const balance = useMemo(() =>
    totalIncome - totalExpense - pendingDebt, [totalIncome, totalExpense, pendingDebt])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { type, amount, description, person, date } = newEntry
    const parsedAmount = parseFloat(amount)

    if (isNaN(parsedAmount) || parsedAmount <= 0 || !description.trim() || (type === 'debt' && !person.trim())) {
      showMessage('error', 'Completa todos los campos correctamente')
      return
    }

    if (type === 'debt') {
      const { error } = await supabase.from('debts').insert({
        id: uuidv4(),
        debtor_name: person,
        amount: parsedAmount,
        reason: description,
        status: 'pending',
        created_at: new Date(date).toISOString(),
      })
      if (error) return showMessage('error', 'Error al guardar deuda')
      showMessage('success', 'Deuda registrada correctamente')
    } else {
      const { error } = await supabase.from('wallet_transactions').insert({
        id: uuidv4(),
        type,
        amount: parsedAmount,
        category: 'General',
        description,
        created_at: new Date(date).toISOString(),
      })
      if (error) return showMessage('error', 'Error al guardar transacción')
      showMessage('success', 'Transacción registrada correctamente')
    }

    setNewEntry({ type: 'income', amount: '', description: '', person: '', date: new Date().toISOString().slice(0, 10) })
    fetchAllData()
  }

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
            description: descripcion,
            category: 'Importado',
            created_at: fecha,
          })
          count++
        }

        if (egreso) {
          await supabase.from('wallet_transactions').insert({
            id: uuidv4(),
            type: 'expense',
            amount: egreso,
            description: descripcion,
            category: 'Importado',
            created_at: fecha,
          })
          count++
        }
      }

      showMessage('success', `${count} registros importados`)
      fetchAllData()
    }

    reader.readAsArrayBuffer(file)
  }

const exportToExcel = () => {
  const headers = ['Fecha', 'Descripción', 'Ingreso', 'Egreso', 'Ahorro', 'Deuda', 'Neto']
  const rows: any[] = []

  // Transacciones
  transactions.forEach(tx => {
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

  // Deudas
  debts.forEach(d => {
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

  // Totales
  const totalIngreso = transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)
  const totalEgreso = transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
  const totalDeuda = debts.reduce((sum, d) => sum + d.amount, 0)
  const totalNeto = totalIngreso - totalEgreso - totalDeuda

  rows.push([])
  rows.push(['Totales', '', totalIngreso, totalEgreso, '', totalDeuda, totalNeto])

  // Crear Excel
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
  XLSX.writeFile(wb, 'Movimientos_Financieros.xlsx')
}


  const handleUpdateTransaction = async () => {
    const { error } = await supabase
      .from('wallet_transactions')
      .update({
        description: editDescription,
        amount: parseFloat(editAmount)
      })
      .eq('id', selectedItem.id)

    if (error) return showMessage('error', 'No se pudo actualizar')
    showMessage('success', 'Actualizado correctamente')
    closePopup()
    fetchAllData()
  }

  const handleMarkDebtAsPaid = async () => {
    const pago = {
      id: uuidv4(),
      type: 'income',
      amount: parseFloat(editAmount),
      category: 'Deuda saldada',
      description: `Pago de ${selectedItem.debtor_name}`,
      created_at: new Date().toISOString()
    }

    const { error: err1 } = await supabase
      .from('debts')
      .update({ status: 'paid' })
      .eq('id', selectedItem.id)

    const { error: err2 } = await supabase
      .from('wallet_transactions')
      .insert(pago)

    if (err1 || err2) return showMessage('error', 'No se pudo marcar como pagada')
    showMessage('success', 'Deuda pagada y registrada')
    closePopup()
    fetchAllData()
  }

  const handleDelete = async () => {
    const table = selectedType === 'debt' ? 'debts' : 'wallet_transactions'
    const { error } = await supabase.from(table).delete().eq('id', selectedItem.id)

    if (error) return showMessage('error', 'Error al eliminar')
    showMessage('success', 'Eliminado correctamente')
    closePopup()
    fetchAllData()
  }

  return (
    <>
      <button className="home-fab" onClick={() => router.push('/')}>
        <FaHouse />
      </button>

      <div className="dashboard">
        <h1 className="dashboard-title">📊 Dashboard Financiero</h1>
        {message && <div className={`alert ${message.type}`}>{message.text}</div>}

        <div className="card-grid">
          <Card title="Ingresos" value={totalIncome} icon={<FaArrowDown className="icon success" />} />
          <Card title="Gastos" value={totalExpense} icon={<FaArrowUp className="icon danger" />} />
          <Card title="Deudas Pendientes" value={pendingDebt} icon={<FaExclamation className="icon warning" />} />
          <Card title="Balance Real" value={balance} icon={<FaDollarSign className="icon primary" />} />
          <Card title="Ahorro Warda" value={totalWarda} icon={<FaDollarSign className="icon primary" />} />
        </div>

        <div className="form-grid">
          <form className="form-card" onSubmit={handleSubmit}>
            <h2>Registrar Movimiento</h2>
            <label>Tipo:
              <select value={newEntry.type} onChange={e => setNewEntry({ ...newEntry, type: e.target.value })}>
                <option value="income">Ingreso</option>
                <option value="expense">Gasto</option>
                <option value="debt">Deuda</option>
              </select>
            </label>
            <label>Cantidad:
              <input type="number" value={newEntry.amount} onChange={e => setNewEntry({ ...newEntry, amount: e.target.value })} />
            </label>
            <label>Descripción:
              <input value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} />
            </label>
            {newEntry.type === 'debt' && (
              <label>Persona:
                <input value={newEntry.person} onChange={e => setNewEntry({ ...newEntry, person: e.target.value })} />
              </label>
            )}
            <label>Fecha:
              <input type="date" value={newEntry.date} onChange={e => setNewEntry({ ...newEntry, date: e.target.value })} />
            </label>
            <button type="submit">Registrar</button>
          </form>
        </div>

        <div className="import-section">
          <h2>📂 Importar / Exportar</h2>
          <input type="file" id="fileUpload" accept=".xlsx" onChange={handleImport} hidden />
          <label htmlFor="fileUpload" className="import-button">
            <FaFileImport /> Importar desde Excel
          </label>
          <button onClick={exportToExcel} className="export-button">
            <FaFileExport /> Exportar a Excel
          </button>
        </div>

       <h2 className="movements-title">🧾 Movimientos recientes</h2>

<ul className="movement-list-enhanced">
  {transactions.map(tx => {
    const isWarda = tx.description.toLowerCase().includes('warda')
    const tipo = isWarda ? 'warda' : tx.type
    const signo = tx.type === 'income' ? '+' : '-'
    return (
      <li key={tx.id} className={`movement-card type-${tipo}`}>
        <div className="card-left">
          <div className="card-description">{tx.description}</div>
          <div className="card-date">{new Date(tx.created_at).toLocaleDateString()}</div>
        </div>
        <div className="card-center">
          <div className="card-amount">{signo}S/{tx.amount.toFixed(2)}</div>
        </div>
        <div className="card-right">
          <button className="card-button" onClick={() => openPopup(tx, 'transaction')}>Detalles</button>
        </div>
      </li>
    )
  })}

  {debts.map(d => (
    <li key={d.id} className={`movement-card type-${d.status === 'pending' ? 'gasto' : 'income'}`}>
      <div className="card-left">
        <div className="card-description">{d.reason} - {d.debtor_name}</div>
        <div className="card-date">{new Date(d.created_at).toLocaleDateString()}</div>
      </div>
      <div className="card-center">
        <div className="card-amount">-S/{d.amount.toFixed(2)}</div>
      </div>
      <div className="card-right">
        <button className="card-button" onClick={() => openPopup(d, 'debt')}>Detalles</button>
      </div>
    </li>
  ))}
</ul>

        {selectedItem && (
          <div className="popup">
            <div className="popup-content">
              <h3>Detalles</h3>
              <label>Descripción:</label>
              <input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
              <label>Monto:</label>
              <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
              {selectedType === 'transaction' && (
                <button className="popup-btn success" onClick={handleUpdateTransaction}>Guardar cambios</button>
              )}
              {selectedType === 'debt' && selectedItem.status === 'pending' && (
                <button className="popup-btn success" onClick={handleMarkDebtAsPaid}>Marcar como pagada</button>
              )}
              <button className="popup-btn delete" onClick={handleDelete}>Eliminar</button>
              <button className="popup-btn close" onClick={closePopup}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Card({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="card">
      <div className="icon-box">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>S/{value.toFixed(2)}</p>
      </div>
    </div>
  )
}
