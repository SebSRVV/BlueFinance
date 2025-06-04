'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import './LoginPage.css'
import { FaHouse } from 'react-icons/fa6'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setError('Debes confirmar tu correo electrónico antes de iniciar sesión.')
      } else {
        setError('Correo o contraseña incorrectos')
      }
    } else if (!data.user) {
      setError('Usuario no encontrado o sin confirmar')
    } else {
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div className="login-page">
      <button className="home-button" onClick={() => router.push('/')}>
        <FaHouse />
      </button>

      <form className="login-box" onSubmit={handleLogin}>
        <h2>🔐 Iniciar sesión</h2>

        {error && <div className="error-msg">{error}</div>}

        <label>
          Email:
          <input
            type="email"
            placeholder="tu@email.com"
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
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}
