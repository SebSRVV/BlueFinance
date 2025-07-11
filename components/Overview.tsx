'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  FaArrowDown, FaArrowUp, FaDollarSign, FaExclamation,
  FaPiggyBank, FaLandmark, FaLeaf, FaMoneyBillAlt
} from 'react-icons/fa'
import { motion } from 'framer-motion'
import '@/app/styles/Overview.css'

type Warda = {
  id: string
  name: string
  balance: number
}

type OverviewItem = {
  title: string
  value: number
  icon: React.ReactNode
  type: string
}

type Debt = {
  id: string
  person_id: string | null
  reason: string
  total_amount: number
  status: string
  account_id?: string
}

type Person = {
  id: string
  name: string
}

export default function Overview() {
  const router = useRouter()

  const [wards, setWards] = useState<Warda[]>([])
  const [debtList, setDebtList] = useState<(Debt & { person_name?: string })[]>([])
  const [stats, setStats] = useState({
    income: 0,
    expense: 0,
    debt: 0,
    balance: 0,
    warda: 0,
    bcp: 0,
    lemon: 0,
    interbank: 0,
    cash: 0,
  })

  const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '')

  const handleCardClick = (type: string) => {
    if (type === 'warda') router.push('/warda')
    if (type === 'debt') router.push('/deudas')
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data: transactions } = await supabase.from('transactions').select('*')
      const { data: wardaList } = await supabase.from('wards').select('*')
      const { data: wardTransactions } = await supabase.from('ward_transactions').select('*')
      const { data: accounts } = await supabase.from('accounts').select('*')
      const { data: debts } = await supabase.from('debts').select('*')
      const { data: people } = await supabase.from('people').select('*')

      if (!transactions || !accounts) return

      const sumByType = (type: string) =>
        transactions.filter(t => t.type === type)
          .reduce((s, t) => s + Number(t.amount), 0)

      const income = sumByType('ingreso')
      const expense = sumByType('gasto')

      const pendingDebts = (debts || []).filter(d => d.status === 'pending')
      const debt = pendingDebts.reduce((total, d) => total + Number(d.total_amount), 0)
      const balance = income - expense - debt

      const calcularBalanceCuenta = (cuentaId: string) => {
        const deudaDeCuenta = (pendingDebts || [])
          .filter(d => d.account_id === cuentaId)
          .reduce((total, d) => total + Number(d.total_amount), 0)

        return transactions.reduce((total, tx) => {
          const amount = Number(tx.amount)

          if (tx.type === 'ingreso' && tx.account_id === cuentaId) {
            return total + amount
          }

          if (tx.type !== 'ingreso' && tx.account_id === cuentaId) {
            return total - amount
          }

          if (tx.type === 'movimiento' && tx.destination_account_id === cuentaId) {
            return total + amount
          }

          return total
        }, 0) - deudaDeCuenta
      }

      const buscarCuenta = (clave: string) =>
        accounts.find(a => normalize(a.name).includes(clave))

      const bcp = buscarCuenta('bcp') ? calcularBalanceCuenta(buscarCuenta('bcp')!.id) : 0
      const lemon = buscarCuenta('lemon') ? calcularBalanceCuenta(buscarCuenta('lemon')!.id) : 0
      const interbank = buscarCuenta('interbank') ? calcularBalanceCuenta(buscarCuenta('interbank')!.id) : 0
      const cash = buscarCuenta('dinero') ? calcularBalanceCuenta(buscarCuenta('dinero')!.id) : 0

      const calculatedWards = (wardaList || []).map(w => {
        const relatedTx = wardTransactions?.filter(t => t.ward_id === w.id) || []
        const balance = relatedTx.reduce((total, t) =>
          total + (t.type === 'deposito' ? Number(t.amount) : -Number(t.amount)), 0)

        return { id: w.id, name: w.name, balance }
      })

      const totalWarda = calculatedWards.reduce((sum, w) => sum + w.balance, 0)

      const enrichedDebts = pendingDebts.map(d => {
        const person = people?.find(p => p.id === d.person_id)
        return {
          ...d,
          person_name: person?.name || 'Desconocido'
        }
      })

      setStats({ income, expense, debt, balance, warda: totalWarda, bcp, lemon, interbank, cash })
      setWards(calculatedWards)
      setDebtList(enrichedDebts)
    }

    fetchData()
  }, [])

  const items: OverviewItem[] = [
    { title: 'Ingresos', value: stats.income, icon: <FaArrowDown className="icon income" />, type: 'income' },
    { title: 'Gastos', value: stats.expense, icon: <FaArrowUp className="icon expense" />, type: 'expense' },
    { title: 'Deudas Pendientes', value: stats.debt, icon: <FaExclamation className="icon debt" />, type: 'debt' },
    { title: 'Balance Real', value: stats.balance, icon: <FaDollarSign className="icon account" />, type: 'balance' },
    { title: 'BCP', value: stats.bcp, icon: <FaLandmark className="icon bcp" />, type: 'bcp' },
    { title: 'Lemon', value: stats.lemon, icon: <FaLeaf className="icon lemon" />, type: 'lemon' },
    { title: 'Interbank', value: stats.interbank, icon: <FaLandmark className="icon interbank" />, type: 'interbank' },
    { title: 'Dinero', value: stats.cash, icon: <FaMoneyBillAlt className="icon cash" />, type: 'cash' },
    { title: 'Ahorro Warda', value: stats.warda, icon: <FaPiggyBank className="icon warda" />, type: 'warda' },
  ]

  return (
    <div className="overview-container">
      {items.map(item => (
        <motion.div
          key={item.title}
          className={`overview-card ${
            item.type === 'warda' ? 'warda-wide clickable'
            : item.type === 'debt' ? 'clickable'
            : ''
          }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          onClick={() => ['warda', 'debt'].includes(item.type) && handleCardClick(item.type)}
        >
          <div className="warda-header">
            <div className="card-icon">{item.icon}</div>
            <div className="card-text">
              <div className="card-title">{item.title}</div>
              <div className="card-value">S/{item.value.toFixed(2)}</div>
            </div>
          </div>

          {/* SOLO Warda tiene desglose */}
          {item.type === 'warda' && wards.length > 0 && (
            <motion.div
              className="warda-inline-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {wards.map(w => (
                <div className="warda-item" key={w.id}>
                  <FaPiggyBank className="warda-icon" />
                  <div className="warda-info">
                    <span className="warda-name">{w.name}</span>
                    <span className="warda-amount">S/{w.balance.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
