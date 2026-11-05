'use client';
import { createContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { api, brl } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import HistoryEditor from './HistoryEditor';
export interface ThemeData { tema: string; valor_centavos: number | null; evitar_repeticao: boolean }
export interface HintData { hints: { id: number; texto: string; created_at: string }[]; participants: { id: number; name: string }[]; guess: number | null; can_send: boolean }
export interface HistoryData { history: { ano: number; giver: string; receiver: string }[] }
const emptyHints: HintData = { hints: [], participants: [], guess: null, can_send: false };
export const SantaThemeContext = createContext<ThemeData>({ tema: 'Livre', valor_centavos: null, evitar_repeticao: true });
export const temas = ['Livre', 'Até R$ 50', 'Feito à mão', 'Só livro', 'Brechó', 'Coisa de cozinha', 'Pior presente'];
export default function Extras({ initialTheme, initialHints, initialHistory, canSend, main, configId }: { initialTheme: ThemeData; initialHints: HintData; initialHistory: HistoryData; canSend: boolean; main: ReactNode; configId: number | null }) {
  const me = useMe(), toast = useToast();
  const [theme, setTheme] = useState(initialTheme), [hintState, setHintState] = useState({ configId, data: initialHints }), [history, setHistory] = useState(initialHistory);
  const [texto, setTexto] = useState(''), [guess, setGuess] = useState(String(initialHints.guess ?? ''));
  const [tema, setTema] = useState(initialTheme.tema), [valor, setValor] = useState(initialTheme.valor_centavos === null ? '' : String(initialTheme.valor_centavos / 100)), [avoid, setAvoid] = useState(initialTheme.evitar_repeticao);
  const [year, setYear] = useState(initialHistory.history[0]?.ano ?? 0), [busy, setBusy] = useState(false);
  const hints = hintState.configId === configId ? hintState.data : emptyHints;
  const years = [...new Set(history.history.map(p => p.ano))];
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api<HintData>('/api/secret-santa/hints', { signal: controller.signal }),
      api<HistoryData>('/api/secret-santa/history', { signal: controller.signal }),
    ]).then(([nextHints, nextHistory]) => {
      if (controller.signal.aborted) return;
      setHintState({ configId, data: nextHints }); setGuess(String(nextHints.guess ?? ''));
      setHistory(nextHistory);
      setYear(current => nextHistory.history.some(p => p.ano === current) ? current : nextHistory.history[0]?.ano ?? 0);
    }).catch(() => {});
    return () => controller.abort();
  }, [configId]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (e) { toast((e as Error).message, 'erro'); } finally { setBusy(false); }
  }
  async function reloadHints() { setHintState({ configId, data: await api<HintData>('/api/secret-santa/hints') }); }
  return <>
    <section className="surface space-y-3 p-5"><p className="kicker">O presente deste Natal</p><h2 className="display break-words text-3xl">{theme.tema}</h2>{theme.valor_centavos !== null && <p>Valor sugerido: {brl(theme.valor_centavos / 100)}</p>}<Link href="/amigo-oculto/ao-vivo" className="btn btn-ghost w-full">Acompanhar revelação ao vivo</Link></section>
    <SantaThemeContext.Provider value={theme}>{main}</SantaThemeContext.Provider>
    <section className="space-y-4"><h2 className="display text-3xl">Dicas anônimas</h2><p className="text-sm text-marfim-2">Só quem tirou você pode enviar. O nome fica em segredo.</p>
      {hints.hints.length ? hints.hints.map(h => <article key={h.id} className="surface space-y-3 p-5"><p className="kicker">Dica do seu amigo oculto</p><p className="whitespace-pre-wrap break-words">{h.texto}</p><div className="flex flex-wrap gap-2">
        <button className="btn btn-quiet" disabled={busy} onClick={() => void run(async () => { await api('/api/reports', { method: 'POST', json: { alvo_tipo: 'dica', alvo_id: h.id, motivo: 'Dica inadequada' } }); toast('Denúncia enviada. Análise em até 24 horas.'); })}>Denunciar</button>
        <button className="btn btn-quiet" disabled={busy} onClick={() => { if (window.confirm('Parar de receber dicas do seu amigo oculto? As dicas recebidas somem e o nome continua em segredo.')) void run(async () => { await api('/api/secret-santa/hints', { method: 'DELETE', json: { id: h.id, action: 'silenciar' } }); await reloadHints(); toast('Pronto, você não recebe mais dicas.'); }); }}>Não quero mais dicas</button>
        {me.is_admin && <button className="btn btn-quiet" disabled={busy} onClick={() => void run(async () => { await api('/api/secret-santa/hints', { method: 'DELETE', json: { id: h.id } }); await reloadHints(); })}>Apagar dica</button>}
      </div></article>) : <p className="text-sm text-marfim-2">Quando chegar uma dica, ela aparece aqui.</p>}
      <button className="btn btn-quiet" disabled={busy} onClick={() => void run(reloadHints)}>Atualizar dicas</button>
      {canSend && <form className="surface space-y-3 p-5" onSubmit={e => { e.preventDefault(); void run(async () => { await api('/api/secret-santa/hints', { method: 'POST', json: { texto } }); setTexto(''); toast('Dica enviada sem seu nome.'); }); }}><label className="block">Dica para quem você tirou<textarea className="field mt-2" maxLength={280} required value={texto} onChange={e => setTexto(e.target.value)} /></label><p className="text-sm text-marfim-2">{texto.length}/280. Até 3 dicas por dia.</p><button disabled={busy} className="btn btn-primary w-full">Enviar dica anônima</button></form>}
      {!!hints.participants.length && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => { await api('/api/secret-santa/guess', { method: 'POST', json: { participant_id: Number(guess) } }); toast('Palpite guardado até a revelação.'); }); }}><label className="block">Quem você acha que tirou você?<select className="field mt-2" required value={guess} onChange={e => setGuess(e.target.value)}><option value="">Escolha uma pessoa</option>{hints.participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="btn btn-ghost w-full" disabled={busy}>Guardar palpite</button></form>}
    </section>
    <section className="space-y-4"><h2 className="display text-3xl">Histórico</h2><p className="text-sm text-marfim-2">Somente edições já reveladas para a família.</p>{years.length ? <><label className="block">Ano<select className="field mt-2" value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y}>{y}</option>)}</select></label>{history.history.filter(p => p.ano === year).map(p => <p key={p.giver} className="border-b border-linha py-3 break-words">{p.giver} tirou {p.receiver}</p>)}</> : <p>Ainda não há edições reveladas.</p>}</section>
    {me.is_admin && <><form className="surface space-y-4 p-5" onSubmit={e => { e.preventDefault(); void run(async () => { const amount = valor.trim() === '' ? null : Math.round(Number(valor.replace(',', '.')) * 100); if (amount !== null && !Number.isFinite(amount)) throw new Error('Informe um valor válido.'); await api('/api/secret-santa/theme', { method: 'PUT', json: { tema, valor_centavos: amount, evitar_repeticao: avoid } }); setTheme({ tema, valor_centavos: amount, evitar_repeticao: avoid }); toast('Combinado salvo.'); }); }}><h2 className="display text-3xl">Tema e valor</h2><label className="block">Tema<input className="field mt-2" list="santa-temas" required maxLength={100} value={tema} onChange={e => { const next = e.target.value; setTema(next); if (next === 'Até R$ 50') setValor('50'); }} /></label><datalist id="santa-temas">{temas.map(t => <option key={t} value={t} />)}</datalist><label className="block">Valor sugerido (R$)<input className="field mt-2" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} /></label><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={avoid} onChange={e => setAvoid(e.target.checked)} />Evitar o mesmo par do ano anterior</label><button disabled={busy} className="btn btn-primary w-full">Salvar combinado</button></form>
      <HistoryEditor onSaved={() => void run(async () => { const result = await api<HistoryData>('/api/secret-santa/history'); setHistory(result); setYear(result.history[0]?.ano ?? 0); })} /></>}
  </>;
}
