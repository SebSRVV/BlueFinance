'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import TransactionForm from '@/components/TransactionForm'
import Overview from '@/components/Overview'
import HistorialMovimientos from '@/components/HistorialMovimientos'
import Acciones from '@/components/Acciones'

import '@/app/styles/Form.css'
import '@/app/styles/Overview.css'
import '@/app/styles/Historial.css'
import './Dashboard.css'

import { FaHouse, FaRotateRight } from 'react-icons/fa6'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const ADMIN_EMAIL = 'sebrojasw@gmail.com'

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      const user = session?.user
      const email = user?.email || null
      const emailVerified = !!user?.email_confirmed_at

      if (!email || email !== ADMIN_EMAIL || !emailVerified) {
        router.push('/error')
      }

      setLoading(false)
    }

    getSession()
  }, [router])

  if (loading) return null

  return (
    <>
      <div className="dashboard-header">
        <button className="home-fab" onClick={() => router.push('/')}>
          <FaHouse />
        </button>

        <button className="refresh-fab" onClick={() => window.location.reload()}>
          <FaRotateRight />
        </button>
      </div>

      <div className="dashboard">
        <h1 className="dashboard-title">📊 Dashboard Financiero</h1>

        <Overview />

        <div className="form-grid">
          <TransactionForm />
        </div>

        <div className="acciones-wrapper">
          <Acciones />
        </div>

        <div className="historial-wrapper">
          <HistorialMovimientos />
        </div>
      </div>
    </>
  )
}
