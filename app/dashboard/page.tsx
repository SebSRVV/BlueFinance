'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import {
  FaArrowDown,
  FaArrowUp,
  FaDollarSign,
  FaExclamationTriangle,
  FaTimes,
  FaCheck,
  FaEdit,
  FaTrash,
  FaFileExcel,
  FaFileImport,
} from 'react-icons/fa'
import { FaHouse } from 'react-icons/fa6'
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const router = useRouter()

  const [newEntry, setNewEntry] = useState({
    type: 'income',
    amount: '',
    description: '',
    person: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const { data: txData, error: txError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: debtData, error: debtError } = await supabase
        .from('debts')
        .select('*')
        .order('created_at', { ascending: false })

      if (txError) showMessage('error', 'Error al cargar transacciones')
      else setTransactions(txData || [])

      if (debtError) showMessage('error', 'Error al cargar deudas')
      else setDebts(debtData || [])

    } catch (error) {
      showMessage('error', 'Error inesperado al cargar datos')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const totalIncome = useMemo(() => (
    transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  ), [transactions])

  const totalExpense = useMemo(() => (
    transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  ), [transactions])

  const pendingDebt = useMemo(() => (
    debts.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0)
  ), [debts])

  const balance = useMemo(() => (
    totalIncome - totalExpense - pendingDebt
  ), [totalIncome, totalExpense, pendingDebt])

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet)

      let successCount = 0

      for (const row of rows as any[]) {
        const monto = parseFloat(row['Monto'])
        const descripcion = row['Descripcion']
        const fecha = new Date(row['Fecha']).toISOString()
        const tipo = monto >= 0 ? 'income' : 'expense'

        if (isNaN(monto) || !descripcion) continue

        const { error } = await supabase.from('wallet_transactions').insert({
          id: uuidv4(),
          type: tipo,
          amount: Math.abs(monto),
          category: 'Importado',
          description: descripcion,
          created_at: fecha,
        })

        if (!error) successCount++
      }

      showMessage('success', `${successCount} movimientos importados correctamente`)
      fetchAllData()
    }

    reader.readAsArrayBuffer(file)
  }

  const formattedItems = useMemo(() => {
    return [
      ...transactions.map(tx => ({
        ...tx,
        title: tx.description,
        type: tx.type,
        date: new Date(tx.created_at).toLocaleDateString(),
        amount: tx.amount,
        colorClass: tx.type === 'income' ? 'success' : 'danger',
        source: 'transaction'
      })),
      ...debts.map(d => ({
        ...d,
        title: `Deuda a ${d.debtor_name}`,
        type: 'debt',
        date: new Date(d.created_at).toLocaleDateString(),
        amount: -d.amount,
        colorClass: d.status === 'pending' ? 'warning' : 'success',
        source: 'debt'
      }))
    ].sort((a, b) => a.created_at < b.created_at ? 1 : -1)
  }, [transactions, debts])

  const openPopup = (item: any) => setSelectedItem(item)
  const closePopup = () => setSelectedItem(null)

  const markAsPaid = async (item: any) => {
    await supabase.from('debts').update({ status: 'paid' }).eq('id', item.id)

    await supabase.from('wallet_transactions').insert({
      id: uuidv4(),
      type: 'income',
      amount: item.amount,
      category: 'Deuda Pagada',
      description: `Pago recibido: ${item.reason}`,
      created_at: new Date().toISOString(),
    })

    showMessage('success', 'Deuda marcada como pagada')
    closePopup()
    fetchAllData()
  }

return (
  <>
    <button
      onClick={() => router.push('/')}
      className="home-fab"
      aria-label="Volver al inicio"
    >
      <FaHouse />
    </button>

    <div className="dashboard">
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <h1 className="dashboard-title">📊 Dashboard Financiero</h1>

      <div className="card-grid">
        <Card title="Ingresos" value={totalIncome} icon={<FaArrowDown className="icon success" />} />
        <Card title="Gastos" value={totalExpense} icon={<FaArrowUp className="icon danger" />} />
        <Card title="Deudas Pendientes" value={pendingDebt} icon={<FaExclamationTriangle className="icon warning" />} />
        <Card title="Balance Real" value={balance} icon={<FaDollarSign className="icon primary" />} />
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
            <input type="number" placeholder="Cantidad" value={newEntry.amount} onChange={e => setNewEntry({ ...newEntry, amount: e.target.value })} />
          </label>

          <label>Descripción:
            <input placeholder="Descripción o motivo" value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} />
          </label>

          {newEntry.type === 'debt' && (
            <label>Nombre de la persona:
              <input placeholder="Nombre de la persona" value={newEntry.person} onChange={e => setNewEntry({ ...newEntry, person: e.target.value })} />
            </label>
          )}

          <label>Fecha:
            <input type="date" value={newEntry.date} onChange={e => setNewEntry({ ...newEntry, date: e.target.value })} />
          </label>

          <button type="submit">Registrar</button>
        </form>
      </div>

      <div className="import-section">
        <h2>📥 Importar Movimientos</h2>
        <input type="file" id="fileUpload" accept=".xlsx,.csv" onChange={handleFileUpload} hidden />
        <label htmlFor="fileUpload" className="import-button">📂 Seleccionar Archivo Excel</label>
      </div>

      <div className="data-grid">
        <h2>🧾 Movimientos Recientes</h2>
        {loading ? (
          <p className="muted">Cargando datos...</p>
        ) : formattedItems.length === 0 ? (
          <p className="muted">No hay movimientos aún.</p>
        ) : (
          <ul className="movement-list">
            {formattedItems.map(item => (
              <li key={item.id} className={`movement-item ${item.colorClass}`}>
                <div className="movement-info">
                  <strong>{item.title}</strong>
                  <span>{item.date}</span>
                </div>
                <div className="movement-amount">S/{Math.abs(item.amount).toFixed(2)}</div>
                <button onClick={() => openPopup(item)}>Ver Detalle</button>
              </li>
            ))}
          </ul>
        )}
      </div>


{selectedItem && (
  <div className="popup">
    <div className="popup-content">
      <h3>{selectedItem.title}</h3>
      <p><strong>Monto:</strong> S/{Math.abs(selectedItem.amount).toFixed(2)}</p>
      <p><strong>Fecha:</strong> {selectedItem.date}</p>
      {selectedItem.reason && <p><strong>Motivo:</strong> {selectedItem.reason}</p>}

      {selectedItem.source === 'debt' && selectedItem.status === 'pending' && (
        <button className="popup-btn success" onClick={() => markAsPaid(selectedItem)}>
          <FaCheck /> Marcar como pagada
        </button>
      )}

      <button className="popup-btn edit" onClick={() => alert('Función de edición aún no implementada')}>
        <FaEdit /> Editar
      </button>

      <button
        className="popup-btn delete"
        onClick={async () => {
          if (confirm('¿Estás seguro de eliminar este registro?')) {
            if (selectedItem.source === 'transaction') {
              await supabase.from('wallet_transactions').delete().eq('id', selectedItem.id)
            } else {
              await supabase.from('debts').delete().eq('id', selectedItem.id)
            }
            closePopup()
            fetchAllData()
          }
        }}
      >
        <FaTrash /> Eliminar
      </button>

      <button className="popup-btn close" onClick={closePopup}>
        <FaTimes /> Cerrar
      </button>
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
