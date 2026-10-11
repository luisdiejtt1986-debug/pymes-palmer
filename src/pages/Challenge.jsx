import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useParams2 } from '../context/ParamsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useCatalog } from '../hooks/useCatalog.js';
import { createChallenge, joinChallengeByCode, listMyChallenges } from '../services/challengeService.js';
import { Badge, EmptyState, ErrorState, Field, Loading } from '../components/Ui.jsx';
import { fmtDate } from '../utils/game.js';

export default function Challenge() {
  const { profile } = useAuth();
  const { params } = useParams2();
  const toast = useToast();
  const nav = useNavigate();
  const catalog = useCatalog();
  const list = useAsync(() => listMyChallenges(profile.id), [profile.id]);
  const [sel, setSel] = useState({ categoryId: '', topicId: '' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  if (catalog.loading || list.loading) return <div className="page"><Loading /></div>;
  if (catalog.error || list.error) return <div className="page"><ErrorState error={catalog.error || list.error} onRetry={() => { catalog.reload(); list.reload(); }} /></div>;
  const cat = catalog.data;
  const topics = cat.topics.filter((t) => t.active && t.categoryId === sel.categoryId);

  const create = async () => {
    setBusy(true);
    try {
      const c = await createChallenge({ profile, params, ...sel });
      setCreated(c);
      list.reload();
      toast.success('Reto creado. Comparte el código con tu rival.');
    } catch (e) { toast.error(e.message || 'No se pudo crear el reto'); }
    setBusy(false);
  };

  const join = async () => {
    setBusy(true);
    try {
      await joinChallengeByCode({ profile, code });
      setCode('');
      list.reload();
      toast.success('¡Te uniste al reto! Ya puedes jugarlo.');
    } catch (e) { toast.error(e.message || 'No se pudo unir al reto'); }
    setBusy(false);
  };

  const play = (c) => nav('/play', { state: { autostart: { kind: 'challenge', challenge: c } } });

  return (
    <div className="page mid fade-in">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 6 }}>Reto 1 vs 1</h1>
      <p className="muted">Dos jugadores responden exactamente las mismas preguntas (sin comodines). Gana quien tenga más puntos; no hace falta jugar al mismo tiempo.</p>

      <div className="section-label">Crear un reto</div>
      <div className="glass pad stack">
        <div className="form-grid cols2">
          <Field label="Categoría" htmlFor="ccat">
            <select id="ccat" className="select" value={sel.categoryId} onChange={(e) => setSel({ categoryId: e.target.value, topicId: '' })}>
              <option value="">Todas</option>
              {cat.categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Tema" htmlFor="ctopic">
            <select id="ctopic" className="select" value={sel.topicId} disabled={!sel.categoryId} onChange={(e) => setSel({ ...sel, topicId: e.target.value })}>
              <option value="">Todos</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={create}>⚔️ Crear reto</button>
        {created && (
          <div className="center stack-sm">
            <span className="small muted">Código para tu rival</span>
            <div><span className="code-big">{created.code}</span></div>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(created.code).then(() => toast.success('Código copiado'))}>Copiar código</button>
          </div>
        )}
      </div>

      <div className="section-label">Unirme con un código</div>
      <div className="glass pad">
        <div className="row gap8">
          <input className="input mono" placeholder="ABC123" maxLength={6} value={code} aria-label="Código del reto" onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase', letterSpacing: '.2em' }} />
          <button className="btn btn-primary" disabled={busy || code.trim().length < 6} onClick={join}>Unirme</button>
        </div>
      </div>

      <div className="section-label">Mis retos</div>
      {list.data.length === 0 ? (
        <EmptyState icon="⚔️" title="Aún no tienes retos" text="Crea uno o únete con el código de un compañero." />
      ) : (
        <div className="stack-sm">
          {list.data.map((c) => {
            const mine = c.scores?.[profile.id];
            const rivalId = c.playerIds.find((i) => i !== profile.id);
            const rival = rivalId ? (c.creatorId === rivalId ? c.creatorName : c.opponentName) : null;
            const rivalScore = rivalId ? c.scores?.[rivalId] : null;
            const won = c.winnerId === profile.id;
            return (
              <div key={c.id} className="glass glass-tight pad" style={{ padding: 14 }}>
                <div className="row wrap gap10">
                  <div className="li-main">
                    <div className="li-title">{rival ? `Tú vs ${rival}` : 'Esperando rival…'}</div>
                    <div className="li-sub">{fmtDate(c.createdAt)} · {c.count} preguntas · código <code>{c.code}</code></div>
                  </div>
                  {c.status === 'finished'
                    ? <Badge tone={c.winnerId === 'draw' ? 'warn' : won ? 'ok' : 'bad'}>{c.winnerId === 'draw' ? 'Empate' : won ? '🏆 Ganaste' : 'Perdiste'}</Badge>
                    : <Badge tone="good">{mine ? 'Esperando al rival' : 'Pendiente'}</Badge>}
                  {!mine && <button className="btn btn-primary btn-sm" onClick={() => play(c)}>Jugar</button>}
                </div>
                {(mine || rivalScore) && (
                  <div className="row gap16 mono small" style={{ marginTop: 8 }}>
                    <span>Tú: {mine ? `${mine.score} pts · ${mine.accuracy}%` : '—'}</span>
                    <span>{rival || 'Rival'}: {rivalScore ? `${rivalScore.score} pts · ${rivalScore.accuracy}%` : '—'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="pager"><button className="btn btn-sm" onClick={list.reload}>↻ Actualizar</button></div>
    </div>
  );
}
