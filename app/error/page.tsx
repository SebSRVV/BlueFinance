'use client'

import { useRouter } from 'next/navigation'
import { FaArrowLeft } from 'react-icons/fa6'
import './Error.css'

export default function ErrorPage() {
  const router = useRouter()

  return (
    <div className="error-container">
      <h1 className="error-title">🚫 Acceso denegado</h1>
      <p className="error-message">No tienes permiso para ver esta página.</p>
      <button className="error-button" onClick={() => router.push('/')}>
        <FaArrowLeft className="error-icon" />
        Volver al inicio
      </button>
    </div>
  )
}
