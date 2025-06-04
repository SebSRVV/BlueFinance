'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import './AdminPanel.css'

const ADMIN_EMAIL = 'sebrojasw@gmail.com' // 👈 CAMBIA esto por tu correo

export default function AdminPanel() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPopup, setShowPopup] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      const email = session?.user?.email || null
      setUserEmail(email)

      if (!email || email !== ADMIN_EMAIL) {
        router.push('/') // o mostrar mensaje de acceso denegado
      }

      setLoading(false)
    }

    getSession()
  }, [router])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const deleteAllData = async () => {
    setDeleting(true)
    try {
      const { error: txError } = await supabase
        .from('wallet_transactions')
        .delete()
        .not('id', 'is', null)

      const { error: debtError } = await supabase
        .from('debts')
        .delete()
        .not('id', 'is', null)

      if (txError || debtError) {
        let errorText = 'Ocurrió un error:\n'
        if (txError) errorText += `- Transacciones: ${txError.message || JSON.stringify(txError)}\n`
        if (debtError) errorText += `- Deudas: ${debtError.message || JSON.stringify(debtError)}`
        showMessage('error', errorText.trim())
      } else {
        showMessage('success', '✅ Todos los registros fueron eliminados correctamente')
      }
    } catch (err: any) {
      showMessage('error', `Error inesperado: ${err.message || 'Desconocido'}`)
    }
    setDeleting(false)
    setShowPopup(false)
  }

  if (loading) {
    return <p style={{ textAlign: 'center', color: 'white' }}>Cargando...</p>
  }

  if (userEmail !== ADMIN_EMAIL) {
    return <p style={{ textAlign: 'center', color: 'white' }}>⛔ Acceso denegado</p>
  }

  return (
    <div className="admin-panel">
      <h1>🛠️ Panel de Administrador</h1>
      <p className="warning-text">Esta acción eliminará todos los datos financieros. Procede con cuidado.</p>

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <button disabled={deleting} onClick={() => setShowPopup(true)}>
        🗑️ Eliminar TODOS los registros
      </button>

      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h2>⚠️ Confirmar eliminación</h2>
            <p>¿Estás seguro de eliminar todos los registros?</p>
            <div className="popup-buttons">
              <button onClick={deleteAllData} disabled={deleting}>Sí, eliminar</button>
              <button className="cancel" onClick={() => setShowPopup(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
