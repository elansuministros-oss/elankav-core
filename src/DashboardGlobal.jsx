import OperacionesCentrales from './OperacionesCentrales';

export default function DashboardGlobal() {
  return (
    <div style={{ padding: '30px', fontFamily: 'Arial' }}>
      <h1>ELANKAV CORE</h1>

      <p>
        Centro de operaciones para todas las unidades del ecosistema.
      </p>

      <OperacionesCentrales />
    </div>
  );
}
