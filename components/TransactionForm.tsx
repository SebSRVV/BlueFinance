'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import '@/app/styles/Form.css'

type TipoTransaccion = 'ingreso' | 'gasto' | 'deuda' | 'prestamo' | 'movimiento'

type Cuenta = { id: string; name: string }
type Categoria = { id: string; name: string; type: string }

type Formulario = {
  tipo: TipoTransaccion
  monto: string
  descripcion: string
  person: string
  categoria: string
  cuenta_id: string
  cuenta_destino_id: string
  fecha: string
  conciliado: boolean
}

export default function TransactionForm() {
  const router = useRouter()
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [mensaje, setMensaje] = useState<string | null>(null)

  const [formulario, setFormulario] = useState<Formulario>({
    tipo: 'ingreso',
    monto: '',
    descripcion: '',
    person: '',
    categoria: 'Deposito',
    cuenta_id: '',
    cuenta_destino_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    conciliado: false,
  })

  useEffect(() => {
    const obtenerDatos = async () => {
      const { data: accs } = await supabase.from('accounts').select('*')
      const { data: cats } = await supabase.from('categories').select('*')
      if (accs) setCuentas(accs)
      if (cats) setCategorias(cats)
    }
    obtenerDatos()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormulario(prev => {
      if (name === 'tipo') {
        let categoriaDefault = ''
        if (value === 'ingreso') categoriaDefault = 'Deposito'
        if (value === 'deuda') categoriaDefault = 'Deuda'
        if (value === 'prestamo') categoriaDefault = 'Prestamo'

        return {
          ...prev,
          tipo: value as TipoTransaccion,
          categoria: categoriaDefault,
          descripcion: '',
          person: '',
          conciliado: false,
          cuenta_destino_id: '',
          cuenta_id: ''
        }
      }

      return {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje(null)

    const {
      tipo,
      monto,
      descripcion,
      person,
      categoria,
      cuenta_id,
      cuenta_destino_id,
      fecha,
      conciliado
    } = formulario

    const parsedAmount = parseFloat(monto)

    if (isNaN(parsedAmount) || parsedAmount <= 0)
      return setMensaje('❌ El monto debe ser mayor a 0')

    if (tipo !== 'movimiento' && !descripcion.trim())
      return setMensaje('❌ La descripción es obligatoria')

    const { data: userData } = await supabase.auth.getUser()
    const user_id = userData?.user?.id
    if (!user_id) return setMensaje('❌ Usuario no autenticado')

    // === TIPO DEUDA ===
    if (tipo === 'deuda') {
      if (!person.trim()) return setMensaje('❌ Debes ingresar el nombre de la persona')
      if (!cuenta_id) return setMensaje('❌ Selecciona una cuenta')

      let person_id: string

      const { data: existingPerson, error: personError } = await supabase
        .from('people')
        .select('id')
        .eq('name', person.trim())
        .eq('user_id', user_id)
        .maybeSingle()

      if (personError) return setMensaje('❌ Error al buscar persona')

      if (existingPerson) {
        person_id = existingPerson.id
      } else {
        const { data: newPerson, error: insertError } = await supabase
          .from('people')
          .insert({
            id: uuidv4(),
            user_id,
            name: person.trim()
          })
          .select('id')
          .single()

        if (insertError) return setMensaje('❌ No se pudo crear el contacto')
        person_id = newPerson.id
      }

      const { error } = await supabase.from('debts').insert({
        id: uuidv4(),
        user_id,
        person_id,
        reason: descripcion,
        total_amount: parsedAmount,
        status: 'pending',
        account_id: cuenta_id,
        created_at: new Date(fecha).toISOString()
      })

      if (error) return setMensaje(`❌ Error al guardar deuda: ${error.message}`)
      setMensaje('✅ Deuda registrada correctamente')

    // === TIPO PRESTAMO ===
    } else if (tipo === 'prestamo') {
      if (!cuenta_id) return setMensaje('❌ Selecciona una cuenta')

      const { error } = await supabase.from('debts').insert({
        id: uuidv4(),
        user_id,
        reason: descripcion,
        category: categoria,
        total_amount: parsedAmount,
        status: 'pending',
        account_id: cuenta_id,
        created_at: new Date(fecha).toISOString()
      })

      if (error) return setMensaje(`❌ Error al guardar préstamo: ${error.message}`)
      setMensaje('✅ Préstamo registrado correctamente')

    // === OTROS TIPOS ===
    } else {
      if (!cuenta_id) return setMensaje('❌ Selecciona la cuenta origen')

      let finalDescripcion = descripcion

      if (tipo === 'movimiento') {
        if (!cuenta_destino_id) return setMensaje('❌ Selecciona la cuenta destino')
        if (cuenta_id === cuenta_destino_id)
          return setMensaje('❌ Cuenta origen y destino no pueden ser iguales')

        const cuentaOrigen = cuentas.find(c => c.id === cuenta_id)?.name || 'Cuenta origen'
        const cuentaDestino = cuentas.find(c => c.id === cuenta_destino_id)?.name || 'Cuenta destino'
        finalDescripcion = `De ${cuentaOrigen} a ${cuentaDestino}`
      }

      const nuevaTransaccion = {
        id: uuidv4(),
        user_id,
        type: tipo,
        amount: parsedAmount,
        description: finalDescripcion,
        category: tipo === 'movimiento' ? null : categoria,
        account_id: cuenta_id,
        destination_account_id: tipo === 'movimiento' ? cuenta_destino_id : null,
        created_at: new Date(fecha).toISOString(),
        is_reconciled: conciliado
      }

      const { error } = await supabase.from('transactions').insert(nuevaTransaccion)
      if (error) return setMensaje(`❌ Error al guardar transacción: ${error.message}`)

      setMensaje('✅ Movimiento registrado correctamente')
    }

    // Resetear formulario
    setFormulario({
      tipo: 'ingreso',
      monto: '',
      descripcion: '',
      person: '',
      categoria: 'Deposito',
      cuenta_id: '',
      cuenta_destino_id: '',
      fecha: new Date().toISOString().slice(0, 10),
      conciliado: false
    })

    window.location.reload()
  }

  const mostrarCategoria = formulario.tipo === 'gasto'
  const mostrarConciliado = ['ingreso', 'gasto'].includes(formulario.tipo)
  const mostrarCuenta = ['ingreso', 'gasto', 'deuda', 'prestamo', 'movimiento'].includes(formulario.tipo)
  const mostrarCuentaDestino = formulario.tipo === 'movimiento'
  const mostrarPersona = formulario.tipo === 'deuda'

  // Generar descripción dinámica en pantalla para movimientos
  const descripcionAuto =
    formulario.tipo === 'movimiento' && formulario.cuenta_id && formulario.cuenta_destino_id
      ? `De ${cuentas.find(c => c.id === formulario.cuenta_id)?.name || ''} a ${cuentas.find(c => c.id === formulario.cuenta_destino_id)?.name || ''}`
      : ''

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h2>📋 Registrar Movimiento</h2>

      <label>Tipo:</label>
      <select name="tipo" value={formulario.tipo} onChange={handleChange}>
        <option value="ingreso">Ingreso</option>
        <option value="gasto">Gasto</option>
        <option value="deuda">Deuda</option>
        <option value="prestamo">Préstamo</option>
        <option value="movimiento">Movimiento</option>
      </select>

      <label>Monto:</label>
      <input name="monto" type="number" value={formulario.monto} onChange={handleChange} />

      {formulario.tipo !== 'movimiento' ? (
        <>
          <label>Descripción:</label>
          <input name="descripcion" value={formulario.descripcion} onChange={handleChange} />
        </>
      ) : (
        descripcionAuto && (
          <p className="descripcion-preview">📝 Descripción: <strong>{descripcionAuto}</strong></p>
        )
      )}

      {mostrarPersona && (
        <>
          <label>Persona:</label>
          <input name="person" value={formulario.person} onChange={handleChange} />
        </>
      )}

      {mostrarCategoria && (
        <>
          <label>Categoría:</label>
          <select name="categoria" value={formulario.categoria} onChange={handleChange}>
            <option value="">Selecciona categoría</option>
            {categorias
              .filter(cat => cat.type === formulario.tipo)
              .map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
          </select>
        </>
      )}

      {mostrarCuenta && (
        <>
          <label>{formulario.tipo === 'movimiento' ? 'Cuenta origen:' : 'Cuenta:'}</label>
          <select name="cuenta_id" value={formulario.cuenta_id} onChange={handleChange}>
            <option value="">Selecciona cuenta</option>
            {cuentas.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      )}

      {mostrarCuentaDestino && (
        <>
          <label>Cuenta destino:</label>
          <select name="cuenta_destino_id" value={formulario.cuenta_destino_id} onChange={handleChange}>
            <option value="">Selecciona cuenta</option>
            {cuentas
              .filter(c => c.id !== formulario.cuenta_id)
              .map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </>
      )}

      <label>Fecha:</label>
      <input name="fecha" type="date" value={formulario.fecha} onChange={handleChange} />

      {mostrarConciliado && (
        <div className="checkbox-group">
          <input
            type="checkbox"
            name="conciliado"
            id="conciliado"
            checked={formulario.conciliado}
            onChange={handleChange}
          />
          <label htmlFor="conciliado">¿Conciliado?</label>
        </div>
      )}

      <button type="submit">Registrar</button>

      {mensaje && <p className={`mensaje ${mensaje.startsWith('✅') ? 'exito' : 'error'}`}>{mensaje}</p>}
    </form>
  )
}
