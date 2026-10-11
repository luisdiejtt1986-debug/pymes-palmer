import { BrandMark } from '../layouts/PlayerLayout.jsx';

export default function ConfigMissing() {
  return (
    <div className="auth-wrap">
      <div className="glass auth-card">
        <BrandMark />
        <h1>Falta configurar Firebase</h1>
        <p className="muted" style={{ marginBottom: 14 }}>
          La aplicación no encontró las variables de entorno de Firebase. Para continuar:
        </p>
        <ol className="stack-sm" style={{ paddingLeft: 20, fontSize: 14 }}>
          <li>Copia <code>.env.example</code> a <code>.env</code>.</li>
          <li>Completa los valores de tu app web (Firebase Console → Configuración del proyecto).</li>
          <li>Reinicia <code>npm run dev</code>.</li>
        </ol>
        <p className="small muted" style={{ marginTop: 14 }}>Los pasos completos están en el README.</p>
      </div>
    </div>
  );
}
