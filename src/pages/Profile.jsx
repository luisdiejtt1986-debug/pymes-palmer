import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { updateOwnProfile } from '../services/userService.js';
import { playerKpis } from '../services/analyticsService.js';
import { AVATARS } from '../data/defaults.js';
import { Avatar, Field } from '../components/Ui.jsx';
import XpBar from '../components/XpBar.jsx';
import EvolutionChart from '../components/EvolutionChart.jsx';
import AchievementsGrid from '../components/AchievementsGrid.jsx';
import { fmtDate } from '../utils/game.js';

export default function Profile() {
  const { profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [name, setName] = useState(profile?.name || '');
  const [busy, setBusy] = useState(false);
  const k = playerKpis(profile);

  const save = async (patch, okMsg) => {
    setBusy(true);
    try { 
      await updateOwnProfile(profile.id, patch); 
      toast.success(okMsg); 
    } catch (e) { 
      console.error(e); 
      toast.error('No se pudo guardar el cambio.'); 
    }
    setBusy(false);
  };

  const items = [
    ['Partidas', k.gamesPlayed], ['Precisión', `${k.accuracy}%`], ['Respuestas correctas', k.correct], ['Mejor racha', `${k.bestStreak} d`],
    ['Mejor puntuación', k.bestScore], ['Tiempo promedio', `${k.avgTime}s`], ['Temas dominados', k.mastered], ['XP total', k.xp],
  ];

  // Formateador seguro de fecha para evitar errores si el timestamp de Firestore viene crudo
  const getFormattedDate = (dateVal) => {
    if (!dateVal) return 'Reciente';
    try {
      if (dateVal.seconds) return fmtDate(dateVal, false);
      return fmtDate(dateVal, false);
    } catch {
      return 'Reciente';
    }
  };

  return (
    <div className="page wide fade-in">
      <div className="glass user-card">
        <div className="user-row">
          <Avatar avatar={profile.avatar} name={profile.name} size="xl" />
          <div className="user-meta">
            <div className="user-name" style={{ fontSize: 24 }}>{profile.name}</div>
            <div className="small muted">{profile.email}</div>
            <div className="level-pill"><span className="dot" />Nivel {profile.level} · {profile.levelName}</div>
            <div className="small muted" style={{ marginTop: 6 }}>Miembro desde {getFormattedDate(profile.createdAt)}</div>
          </div>
        </div>
        <XpBar xp={profile.xp} />
      </div>

      <div className="section-label">Estadísticas</div>
      <div className="grid4">
        {items.map(([l, v]) => <div className="glass glass-tight rs-card" key={l}><div className="num">{v}</div><div className="lbl">{l}</div></div>)}
      </div>

      <div className="section-label">Evolución</div>
      <div className="glass pad"><EvolutionChart uid={profile.id} /></div>

      <div className="section-label">Logros</div>
      <AchievementsGrid uid={profile.id} />

      <div className="section-label">Personalizar</div>
      <div className="glass pad stack">
        <Field label="Nombre" htmlFor="pname">
          <div className="row gap8">
            <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            <button className="btn btn-primary" disabled={busy || name.trim().length < 2 || name.trim() === profile.name} onClick={() => save({ name }, 'Nombre actualizado')}>Guardar</button>
          </div>
        </Field>
        <div className="field">
          <span className="label">Avatar</span>
          <div className="chip-row" style={{ flexWrap: 'wrap' }} role="group" aria-label="Avatar">
            <button className={`chip ${!profile.avatar ? 'active' : ''}`} onClick={() => save({ avatar: '' }, 'Avatar actualizado')}>Iniciales</button>
            {AVATARS.map((a) => (
              <button key={a} className={`chip ${profile.avatar === a ? 'active' : ''}`} style={{ fontSize: 20 }} aria-label={`Avatar ${a}`} onClick={() => save({ avatar: a }, 'Avatar actualizado')}>{a}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Tema visual</span>
          <div className="seg" role="group" aria-label="Tema visual">
            {[['dark', '🌙 Oscuro'], ['light', '☀️ Claro']].map(([v, l]) => (
              <button key={v} className={theme === v ? 'active' : ''} onClick={() => { setTheme(v); updateOwnProfile(profile.id, { theme: v }).catch(() => {}); }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
