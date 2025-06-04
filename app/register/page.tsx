'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import './RegisterPage.css'
import { FaHouse } from 'react-icons/fa6'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/dashboard`, // Cambia si tienes una página de confirmación
      }
    })

    if (error) {
      setError('Error al registrar: ' + error.message)
    } else {
      setSuccess('Cuenta creada. Revisa tu correo para confirmar tu email.')
      setEmail('')
      setPassword('')
    }

    setLoading(false)
  }

  return (
    <div className="register-page">
      <button className="home-button" onClick={() => router.push('/')}>
        <FaHouse />
      </button>

      <form className="register-box" onSubmit={handleRegister}>
        <h2>📝 Crear cuenta</h2>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        <label>
          Email:
          <input
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Contraseña:
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrarse'}
        </button>

        <p className="login-link">
          ¿Ya tienes una cuenta? <a href="/login">Inicia sesión</a>
        </p>
      </form>
    </div>
  )
}
