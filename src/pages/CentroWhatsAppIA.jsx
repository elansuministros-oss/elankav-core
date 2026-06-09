import { useState } from 'react';
import { clasificarMensajeWhatsApp } from '../ai/WhatsAppAIEngine';
import {
  crearLeadDesdeWhatsApp,
  guardarLeadTemporalCRM,
  obtenerLeadsTemporalesCRM,
} from '../ai/CRMLeadBridge';

export default function CentroWhatsAppIA() {
  const [mensaje, setMensaje] = useState('');
  const [resultado, setResultado] = useState(null);
  const [leadCRM, setLeadCRM] = useState(null);
  const [leadsTemporales, setLeadsTemporales] = useState(() =>
    obtenerLeadsTemporalesCRM()
  );

  const analizar = () => {
    const clasificacion = clasificarMensajeWhatsApp(mensaje);
    const lead = crearLeadDesdeWhatsApp(clasificacion);
    const listaActualizada = guardarLeadTemporalCRM(lead);

    setResultado(clasificacion);
    setLeadCRM(lead);
    setLeadsTemporales(listaActualizada);
  };

  return (
    <section className="ia-panel">
      <div className="ia-header">
        <span>Centro WhatsApp · ELAN AI</span>
        <h2>WhatsApp Inteligente</h2>
        <p>
          Clasifica mensajes, genera un lead CRM y lo deja preparado para sincronizarse
          con CRM CENTRAL.
        </p>
      </div>

      <div className="ia-consulta">
        <input
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Pegá aquí el mensaje recibido por WhatsApp..."
        />
        <button type="button" onClick={analizar}>
          Clasificar y preparar Lead
        </button>
      </div>

      {resultado && (
        <div className="ia-respuesta">
          <strong>Clasificación IA:</strong>
          <p><b>Unidad:</b> {resultado.unidadDetectada}</p>
          <p><b>Servicio:</b> {resultado.servicioDetectado}</p>
          <p><b>Tipo de cliente:</b> {resultado.tipoCliente}</p>
          <p><b>Estado del lead:</b> {resultado.estadoLead}</p>
          <p><b>Prioridad:</b> {resultado.prioridad}</p>
          <p><b>Origen:</b> {resultado.origen}</p>
          <p><b>Respuesta sugerida:</b> {resultado.respuestaSugerida}</p>
        </div>
      )}

      {leadCRM && (
        <div className="ia-respuesta">
          <strong>Lead preparado para CRM CENTRAL:</strong>
          <p><b>ID:</b> {leadCRM.id}</p>
          <p><b>Unidad:</b> {leadCRM.unidadNegocio}</p>
          <p><b>Servicio:</b> {leadCRM.servicioSolicitado}</p>
          <p><b>Estado:</b> {leadCRM.estado}</p>
          <p><b>Prioridad:</b> {leadCRM.prioridad}</p>
          <p><b>Listo para CRM:</b> {leadCRM.listoParaCRM ? 'Sí' : 'No'}</p>
        </div>
      )}

      <div className="ia-respuesta">
        <strong>Leads temporales listos para sincronizar:</strong>
        <p>{leadsTemporales.length} lead(s) pendiente(s).</p>
      </div>
    </section>
  );
}