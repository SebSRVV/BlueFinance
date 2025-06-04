'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import './MainPage.css'
import {
  FaChartPie,
  FaUserShield,
  FaAddressCard,
  FaUserPlus,
  FaMoneyBillTrendUp,
  FaRightFromBracket,
} from 'react-icons/fa6'

export default function MainPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (user && !error && user.email) {
        setUserEmail(user.email)
      }
    }

    fetchUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUserEmail(null)
    router.refresh() // Para recargar la UI y reflejar el estado de sesión
  }

  return (
    <main className="main-page">
      <header className="top-bar">
        <div className="logo-bar">
          <FaMoneyBillTrendUp className="logo-icon" />
          <span>BlueFinance</span>
        </div>

        <div className="auth-buttons">
          {userEmail ? (
            <>
              <span className="user-email">👤USUARIO: {userEmail}</span>
              <button onClick={handleLogout} className="auth logout">
                <FaRightFromBracket />
                <span>Cerrar Sesión</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => router.push('/login')} className="auth login">
                <FaAddressCard />
                <span>Iniciar Sesión</span>
              </button>
              <button onClick={() => router.push('/register')} className="auth register">
                <FaUserPlus />
                <span>Registrarse</span>
              </button>
            </>
          )}
        </div>
      </header>

      <section className="content">
        <div className="left">
          <h1>BlueFinance</h1>
          <p>Proyecto personal desarrollado por SebRVV.</p>
        </div>
        <div className="right">
          <button onClick={() => router.push('/dashboard')}>
            <FaChartPie />
            <span>Panel Financiero</span>
          </button>
          <button onClick={() => router.push('/panel')} className="admin">
            <FaUserShield />
            <span>Modo Administrador</span>
          </button>
        </div>
      </section>
    </main>
  )
}
