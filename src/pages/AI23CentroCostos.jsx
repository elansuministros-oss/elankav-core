import { useEffect, useMemo, useState } from "react";
import { createAI23Services, AI23_MONEDAS, AI23_ESTADOS } from "../../lib/ai23/index.js";
import "./AI23CentroCostos.css";

const services = createAI23Services();

const TABS = [
  { id: "dashboard", label: "Centro de Costos" },
  { id: "componentes", label: "Componentes" },
  { id: "combinaciones", label: "Combinaciones" },
  { id: "adicionales", label: "Adicionales" },
  { id: "referencia", label: "Costos Ref." },
  { id: "motor", label: "Motor" }
];

const emptyForms = {
  componentes: { codigo:"", nombre:"", descripcion:"", categoria:"", unidad:"m2", moneda:"USD", costo_unitario:"", merma_porcentaje:"0", estado:"activo" },
  combinaciones: { codigo:"", nombre:"", descripcion:"", categoria:"", unidad_resultado:"unidad", margen_porcentaje:"0", mano_obra:"0", indirectos:"0", estado:"activo" },
  adicionales: { codigo:"", nombre:"", descripcion:"", categoria:"", unidad:"unidad", moneda:"USD", precio:"", costo_referencia:"0", margen_porcentaje:"0", estado:"activo" },
  referencia: { codigo:"", nombre:"", descripcion:"", categoria:"", unidad:"unidad", moneda:"USD", costo:"", proveedor_id:"", item_origen_id:"", estado:"activo" }
};

function money(value, moneda = "USD") {
  const n = Number(value || 0);
  return `${moneda} ${n.toFixed(2)}`;
}

function getError(result, fallback) {
  return result?.error?.message || result?.error?.code || fallback || "Error AI-23";
}

export default function AI23CentroCostos() {
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [componentes, setComponentes] = useState([]);
  const [combinaciones, setCombinaciones] = useState([]);
  const [adicionales, setAdicionales] = useState([]);
  const [referencia, setReferencia] = useState([]);

  const [forms, setForms] = useState(emptyForms);
  const [editando, setEditando] = useState(null);

  const [motor, setMotor] = useState({
    moneda: "USD",
    tipo_cambio: "36.80",
    mano_obra: "0",
    indirectos: "0",
    margen_porcentaje: "30",
    componente_id: "",
    componente_cantidad: "1",
    adicional_id: "",
    adicional_cantidad: "1",
    componentes: [],
    adicionales: [],
    resultado: null
  });

  const resumen = useMemo(() => ({
    componentes: componentes.length,
    combinaciones: combinaciones.length,
    adicionales: adicionales.length,
    referencia: referencia.length
  }), [componentes, combinaciones, adicionales, referencia]);

  async function cargarTodo() {
    setLoading(true);
    setError("");

    try {
      const [r1, r2, r3, r4] = await Promise.all([
        services.componentes.listar(),
        services.combinaciones.listar(),
        services.adicionales.listar(),
        services.costosReferencia.listar()
      ]);

      if (!r1.ok) throw new Error(getError(r1, "No se pudieron cargar componentes."));
      if (!r2.ok) throw new Error(getError(r2, "No se pudieron cargar combinaciones."));
      if (!r3.ok) throw new Error(getError(r3, "No se pudieron cargar adicionales."));
      if (!r4.ok) throw new Error(getError(r4, "No se pudieron cargar costos de referencia."));

      setComponentes(r1.data || []);
      setCombinaciones(r2.data || []);
      setAdicionales(r3.data || []);
      setReferencia(r4.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  function setForm(tipo, campo, valor) {
    setForms((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], [campo]: valor }
    }));
  }

  function editar(tipo, item) {
    setTab(tipo);
    setEditando({ tipo, id: item.id });
    setForms((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], ...item }
    }));
  }

  function cancelar(tipo) {
    setEditando(null);
    setForms((prev) => ({ ...prev, [tipo]: emptyForms[tipo] }));
  }

  async function guardar(tipo) {
    setLoading(true);
    setError("");

    try {
      const serviceMap = {
        componentes: services.componentes,
        combinaciones: services.combinaciones,
        adicionales: services.adicionales,
        referencia: services.costosReferencia
      };

      const payload = forms[tipo];
      const service = serviceMap[tipo];

      const result = editando?.tipo === tipo
        ? await service.actualizar(editando.id, payload)
        : await service.crear(payload);

      if (!result.ok) throw new Error(getError(result, "No se pudo guardar."));

      cancelar(tipo);
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function eliminar(tipo, id) {
    const seguro = window.confirm("¿Eliminar este registro AI-23?");
    if (!seguro) return;

    setLoading(true);
    setError("");

    try {
      const serviceMap = {
        componentes: services.componentes,
        combinaciones: services.combinaciones,
        adicionales: services.adicionales,
        referencia: services.costosReferencia
      };

      const result = await serviceMap[tipo].eliminar(id);
      if (!result.ok) throw new Error(getError(result, "No se pudo eliminar."));

      await cargarTodo();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function agregarMotorComponente() {
    const item = componentes.find((x) => String(x.id) === String(motor.componente_id));
    if (!item) return;

    setMotor((prev) => ({
      ...prev,
      componentes: [
        ...prev.componentes,
        {
          ...item,
          cantidad: Number(prev.componente_cantidad || 1),
          factor_merma: 0
        }
      ],
      componente_id: "",
      componente_cantidad: "1"
    }));
  }

  function agregarMotorAdicional() {
    const item = adicionales.find((x) => String(x.id) === String(motor.adicional_id));
    if (!item) return;

    setMotor((prev) => ({
      ...prev,
      adicionales: [
        ...prev.adicionales,
        {
          ...item,
          cantidad: Number(prev.adicional_cantidad || 1)
        }
      ],
      adicional_id: "",
      adicional_cantidad: "1"
    }));
  }

  function calcularMotor() {
    const result = services.motorCostos.calcularManual({
      moneda: motor.moneda,
      tipo_cambio: motor.tipo_cambio,
      mano_obra: motor.mano_obra,
      indirectos: motor.indirectos,
      margen_porcentaje: motor.margen_porcentaje,
      componentes: motor.componentes,
      adicionales: motor.adicionales
    });

    if (!result.ok) {
      setError(getError(result, "No se pudo calcular."));
      return;
    }

    setError("");
    setMotor((prev) => ({ ...prev, resultado: result.data }));
  }

  return (
    <section className="ai23">
      <header className="ai23-hero">
        <div>
          <span>AI-23 Release 1.0</span>
          <h1>Centro de Costos ELAN</h1>
          <p>Motor administrativo para componentes, combinaciones, adicionales y costos de referencia.</p>
        </div>
        <button type="button" onClick={cargarTodo} disabled={loading}>
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </header>

      {error && <div className="ai23-error">{error}</div>}

      <nav className="ai23-tabs">
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <div className="ai23-grid">
          <Stat title="Componentes" value={resumen.componentes} />
          <Stat title="Combinaciones" value={resumen.combinaciones} />
          <Stat title="Adicionales" value={resumen.adicionales} />
          <Stat title="Costos Referencia" value={resumen.referencia} />
        </div>
      )}

      {tab === "componentes" && (
        <CrudPanel
          title="Componentes"
          tipo="componentes"
          form={forms.componentes}
          rows={componentes}
          setForm={setForm}
          guardar={guardar}
          cancelar={cancelar}
          editar={editar}
          eliminar={eliminar}
          editando={editando}
          fields={["codigo","nombre","descripcion","categoria","unidad","moneda","costo_unitario","merma_porcentaje","estado"]}
        />
      )}

      {tab === "combinaciones" && (
        <CrudPanel
          title="Combinaciones"
          tipo="combinaciones"
          form={forms.combinaciones}
          rows={combinaciones}
          setForm={setForm}
          guardar={guardar}
          cancelar={cancelar}
          editar={editar}
          eliminar={eliminar}
          editando={editando}
          fields={["codigo","nombre","descripcion","categoria","unidad_resultado","margen_porcentaje","mano_obra","indirectos","estado"]}
        />
      )}

      {tab === "adicionales" && (
        <CrudPanel
          title="Adicionales"
          tipo="adicionales"
          form={forms.adicionales}
          rows={adicionales}
          setForm={setForm}
          guardar={guardar}
          cancelar={cancelar}
          editar={editar}
          eliminar={eliminar}
          editando={editando}
          fields={["codigo","nombre","descripcion","categoria","unidad","moneda","precio","costo_referencia","margen_porcentaje","estado"]}
        />
      )}

      {tab === "referencia" && (
        <CrudPanel
          title="Costos de Referencia"
          tipo="referencia"
          form={forms.referencia}
          rows={referencia}
          setForm={setForm}
          guardar={guardar}
          cancelar={cancelar}
          editar={editar}
          eliminar={eliminar}
          editando={editando}
          fields={["codigo","nombre","descripcion","categoria","unidad","moneda","costo","proveedor_id","item_origen_id","estado"]}
        />
      )}

      {tab === "motor" && (
        <section className="ai23-panel">
          <h2>Motor de Costos</h2>

          <div className="ai23-form">
            <label>Moneda<select value={motor.moneda} onChange={(e)=>setMotor({...motor, moneda:e.target.value})}><option>{AI23_MONEDAS.USD}</option><option>{AI23_MONEDAS.NIO}</option></select></label>
            <label>Tipo cambio<input value={motor.tipo_cambio} onChange={(e)=>setMotor({...motor, tipo_cambio:e.target.value})} /></label>
            <label>Mano de obra<input value={motor.mano_obra} onChange={(e)=>setMotor({...motor, mano_obra:e.target.value})} /></label>
            <label>Indirectos<input value={motor.indirectos} onChange={(e)=>setMotor({...motor, indirectos:e.target.value})} /></label>
            <label>Margen %<input value={motor.margen_porcentaje} onChange={(e)=>setMotor({...motor, margen_porcentaje:e.target.value})} /></label>
          </div>

          <div className="ai23-duo">
            <div>
              <h3>Agregar componente</h3>
              <select value={motor.componente_id} onChange={(e)=>setMotor({...motor, componente_id:e.target.value})}>
                <option value="">Seleccionar</option>
                {componentes.map((item)=><option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
              <input value={motor.componente_cantidad} onChange={(e)=>setMotor({...motor, componente_cantidad:e.target.value})} />
              <button onClick={agregarMotorComponente}>Agregar</button>
            </div>

            <div>
              <h3>Agregar adicional</h3>
              <select value={motor.adicional_id} onChange={(e)=>setMotor({...motor, adicional_id:e.target.value})}>
                <option value="">Seleccionar</option>
                {adicionales.map((item)=><option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
              <input value={motor.adicional_cantidad} onChange={(e)=>setMotor({...motor, adicional_cantidad:e.target.value})} />
              <button onClick={agregarMotorAdicional}>Agregar</button>
            </div>
          </div>

          <button className="ai23-main-btn" onClick={calcularMotor}>Calcular costo</button>

          {motor.resultado && (
            <div className="ai23-result">
              <strong>Total: {money(motor.resultado.resumen.total, motor.resultado.moneda)}</strong>
              <span>Base: {money(motor.resultado.resumen.costo_base, motor.resultado.moneda)}</span>
              <span>Margen: {money(motor.resultado.resumen.margen_valor, motor.resultado.moneda)}</span>
              <span>Total USD: {motor.resultado.resumen.total_usd === null ? "Sin TC" : money(motor.resultado.resumen.total_usd, "USD")}</span>
              <span>Total NIO: {motor.resultado.resumen.total_nio === null ? "Sin TC" : money(motor.resultado.resumen.total_nio, "NIO")}</span>
            </div>
          )}
        </section>
      )}
    </section>
  );
}

function Stat({ title, value }) {
  return <article className="ai23-stat"><span>{title}</span><strong>{value}</strong></article>;
}

function CrudPanel({ title, tipo, form, rows, fields, setForm, guardar, cancelar, editar, eliminar, editando }) {
  return (
    <section className="ai23-panel">
      <h2>{title}</h2>

      <div className="ai23-form">
        {fields.map((field) => (
          <label key={field}>
            {field.replaceAll("_", " ")}
            {field === "moneda" ? (
              <select value={form[field] || "USD"} onChange={(e) => setForm(tipo, field, e.target.value)}>
                <option>{AI23_MONEDAS.USD}</option>
                <option>{AI23_MONEDAS.NIO}</option>
              </select>
            ) : field === "estado" ? (
              <select value={form[field] || "activo"} onChange={(e) => setForm(tipo, field, e.target.value)}>
                <option>{AI23_ESTADOS.activo}</option>
                <option>{AI23_ESTADOS.inactivo}</option>
              </select>
            ) : (
              <input value={form[field] ?? ""} onChange={(e) => setForm(tipo, field, e.target.value)} />
            )}
          </label>
        ))}
      </div>

      <div className="ai23-actions">
        <button type="button" onClick={() => guardar(tipo)}>
          {editando?.tipo === tipo ? "Actualizar" : "Crear"}
        </button>
        {editando?.tipo === tipo && <button type="button" onClick={() => cancelar(tipo)}>Cancelar</button>}
      </div>

      <div className="ai23-table-wrap">
        <table className="ai23-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Unidad</th>
              <th>Valor</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan="7">Sin registros.</td></tr>
            )}

            {rows.map((item) => (
              <tr key={item.id}>
                <td>{item.codigo || "-"}</td>
                <td>{item.nombre}</td>
                <td>{item.categoria || "-"}</td>
                <td>{item.unidad || item.unidad_resultado || "-"}</td>
                <td>{money(item.costo_unitario ?? item.precio ?? item.costo ?? 0, item.moneda || "USD")}</td>
                <td>{item.estado}</td>
                <td>
                  <button onClick={() => editar(tipo, item)}>Editar</button>
                  <button onClick={() => eliminar(tipo, item.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
