import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function TestSupabase() {
  const [estado, setEstado] = useState("Probando conexión...")

  useEffect(() => {
    async function probar() {
      try {
        const { error } = await supabase
          .from("clientes")
          .select("*")
          .limit(1)

        if (error) {
          setEstado("Conectado, pero tabla clientes respondió: " + error.message)
          return
        }

        setEstado("Conexión Supabase OK")
      } catch (err) {
        setEstado("Error: " + err.message)
      }
    }

    probar()
  }, [])

  return (
    <section className="module-card">
      <span>Diagnóstico</span>
      <h2>Supabase</h2>
      <p>{estado}</p>
    </section>
  )
}
