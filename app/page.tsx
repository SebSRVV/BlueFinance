'use client'

import { useRouter } from 'next/navigation'
import './MainPage.css'
import {
  FaChartPie,
  FaUserShield,
  FaAddressCard,
  FaUserPlus,
  FaMoneyBillTrendUp,
} from 'react-icons/fa6'

export default function MainPage() {
  const router = useRouter()

  return (
    <main className="main-page">
      <header className="top-bar">
        <div className="logo-bar">
          <FaMoneyBillTrendUp className="logo-icon" />
          <span>BlueFinance</span>
        </div>
        <div className="auth-buttons">
          <button onClick={() => router.push('/login')} className="auth login">
            <FaAddressCard />
            <span>Iniciar Sesión</span>
          </button>
          <button onClick={() => router.push('/register')} className="auth register">
            <FaUserPlus />
            <span>Registrarse</span>
          </button>
        </div>
      </header>

      <section className="content">
        <div className="left">
          <h1>BlueFinance</h1>
          <p>
            Proyecto personal desarrollado por SebRVV.
          </p>
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
