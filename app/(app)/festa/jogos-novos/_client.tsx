'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Baby, Camera, Check, Drama, Gift, Play, RotateCw, Shuffle, SkipForward, Square, Swords, Trophy, Users } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import { api, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import type { JogosNovosPainel, ModoMimica } from '@/app/api/festa/jogos-novos/_tipos';

const URL_API = '/api/festa/jogos-novos';
const cartao = 'rounded-2xl border border-linha bg-carvao-2 p-5';

interface Estado { d: JogosNovosPainel; em: number }

export default function JogosNovosClient({ initial }: { initial: JogosNovosPainel | null }) {
  const me = useMe();
  const toast = useToast();
  const [est, setEst] = useState<Estado | null>(() => (initial ? { d: initial, em: Date.now() } : null));
  const [tick, setTick] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState<ModoMimica>('mimica');
  const [duracao, setDuracao] = useState(60);
  const [respostaId, setRespostaId] = useState('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [prendasTexto, setPrendasTexto] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(async () => {
    try {
      const d = await api<JogosNovosPainel>(URL_API);
      setEst({ d, em: Date.now() });
    } catch {
      /* falha pontual de rede: tenta de novo no próximo ciclo */
    }
  }, []);

  useEffect(() => {
    const a = window.setInterval(() => { if (!document.hidden) void recarregar(); }, 4000);
    const b = window.setInterval(() => setTick(Date.now()), 500);
    return () => { window.clearInterval(a); window.clearInterval(b); };
  }, [recarregar]);

  async function acao(nome: string, extra: Record<string, unknown> = {}, aviso?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const d = await api<JogosNovosPainel>(URL_API, { method: 'POST', json: { acao: nome, ...extra } });
      setEst({ d, em: Date.now() });
      if (aviso) toast(aviso);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function enviarFoto(file: File | undefined) {
    if (!file) return;
    if (!respostaId) { toast('Escolha primeiro quem é o bebê da foto.', 'erro'); return; }
    setEnviandoFoto(true);
    try {
      const url = await uploadImage(file);
      await acao('bebe_criar', { foto_url: url, resposta_user_id: Number(respostaId) }, 'Foto no ar!');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setEnviandoFoto(false);
      if (arquivo.current) arquivo.current.value = '';
    }
  }

  if (!est) {
    return <><PageHeader kicker="A noite da ceia" title="Jogos da noite" back="/festa" />
      <div className="px-5 pb-8"><div className={cartao}><p className="text-sm text-marfim-2">Os jogos da noite ainda não foram ativados no servidor. Avise quem organiza.</p></div></div></>;
  }

  const d = est.d;
  const adm = me.is_admin;
  const m = d.mimica;
  const restante = m && m.status === 'jogando' ? Math.max(0, m.restante_ms - (tick - est.em)) : 0;
  const euJogo = Boolean(m && m.quem_joga_id === me.id && m.status === 'jogando' && restante > 0);

  return <>
    <PageHeader kicker={`Natal ${d.ano}`} title="Jogos da noite" back="/festa" />
    <div className="space-y-5 px-5 pb-10">

      {m && <section className={cartao} aria-live="polite">
        <p className="kicker mb-2 flex items-center gap-2"><Drama size={16} strokeWidth={1.5} /> {m.modo === 'desenho' ? 'Desenho' : 'Mímica'}</p>
        {euJogo && m.palavra ? <>
          <p className="text-sm text-marfim-2">Sua vez. Só você está vendo isto:</p>
          <p className="display my-4 break-words text-center text-5xl leading-tight text-champagne">{m.palavra}</p>
          <p className="mb-4 text-center text-3xl font-bold tabular-nums">{Math.ceil(restante / 1000)} s</p>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-primary" disabled={busy} onClick={() => void acao('mimica_resultado', { mimica_id: m.id, resultado: 'acertou' })}><Check size={18} /> Acertaram!</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void acao('mimica_passar', { mimica_id: m.id })}><SkipForward size={18} /> Passar</button>
          </div>
        </> : <>
          <p className="display text-2xl">{m.status === 'jogando' ? `Vez de ${m.quem_joga_nome}` : m.status === 'acertou' ? 'Acertaram!' : 'Acabou o tempo'}</p>
          <p className="mt-1 text-sm text-marfim-2">{m.time_nome}{m.status === 'jogando' ? ` · ${Math.ceil(restante / 1000)} s` : ''}</p>
          <p className="mt-3 text-sm text-marfim-2">{m.status === 'jogando' ? 'Olhe para o telão e tente adivinhar!' : 'Aguarde a próxima rodada.'}</p>
          {adm && m.status === 'jogando' && <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="btn btn-primary" disabled={busy} onClick={() => void acao('mimica_resultado', { mimica_id: m.id, resultado: 'acertou' })}>Acertaram!</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void acao('mimica_resultado', { mimica_id: m.id, resultado: 'tempo' })}>Fim do tempo</button>
          </div>}
        </>}
      </section>}

      {d.bebe && <section className={cartao}>
        <p className="kicker mb-2 flex items-center gap-2"><Baby size={16} strokeWidth={1.5} /> Quem é o bebê?</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={d.bebe.foto_url} alt="Foto de bebê misteriosa" className="mx-auto mb-4 max-h-72 rounded-xl object-cover" />
        {d.bebe.status === 'aberta' ? <>
          <p className="mb-3 text-sm text-marfim-2">{d.bebe.total_votos} {d.bebe.total_votos === 1 ? 'palpite' : 'palpites'}. Toque em um nome para votar (dá para mudar).</p>
          <div className="grid grid-cols-2 gap-2">{d.pessoas.map((p) => <button key={p.id} disabled={busy}
            onClick={() => void acao('bebe_votar', { bebe_id: d.bebe!.id, palpite_user_id: p.id })}
            className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${d.bebe!.meu_palpite === p.id ? 'border-champagne bg-champagne/15 text-marfim' : 'border-linha text-marfim-2 hover:border-champagne/50'}`}>{p.nome}</button>)}</div>
          {adm && <button className="btn btn-primary mt-4 w-full" disabled={busy} onClick={() => void acao('bebe_revelar', { bebe_id: d.bebe!.id })}>Revelar resposta</button>}
        </> : <>
          <p className="display text-3xl">Era {d.bebe.resposta_nome}!</p>
          <ul className="mt-3 space-y-1 text-sm text-marfim-2">{d.bebe.votos_por_pessoa.map((v) => <li key={v.nome}>{v.nome}: {v.votos}</li>)}</ul>
        </>}
      </section>}

      {d.roleta && <section className={cartao}>
        <p className="kicker mb-2 flex items-center gap-2"><Gift size={16} strokeWidth={1.5} /> Roleta de prendas</p>
        {d.roleta.girada ? <>
          <p className="display text-3xl">{d.roleta.sorteado_nome}</p>
          <p className="mt-2 text-marfim-2">{d.roleta.prenda}</p>
        </> : <p className="text-sm text-marfim-2">Olhe para o telão: a roleta vai girar.</p>}
      </section>}

      {d.times.length > 0 && <section className={cartao}>
        <p className="kicker mb-3 flex items-center gap-2"><Trophy size={16} strokeWidth={1.5} /> Placar dos times</p>
        <div className="grid gap-3">{d.times.map((t) => <div key={t.id} className="rounded-xl border border-linha p-4" style={{ borderLeft: `6px solid ${t.cor}` }}>
          <div className="flex items-baseline justify-between gap-3"><h3 className="display text-xl">{t.nome}</h3><span className="display text-3xl tabular-nums">{t.pontos}</span></div>
          <p className="mt-1 text-xs text-marfim-2">{t.membros.map((p) => p.nome).join(', ') || 'Sem ninguém ainda'}</p>
          {adm && <div className="mt-3 flex flex-wrap gap-2">{[-1, 1, 5, 10].map((v) => <button key={v} className="btn btn-ghost min-h-11 px-4 text-sm" disabled={busy}
            onClick={() => void acao('pontos', { team_id: t.id, pontos: v })}>{v > 0 ? `+${v}` : v}</button>)}</div>}
        </div>)}</div>
      </section>}

      {!m && !d.bebe && !d.roleta && d.times.length === 0 && !adm && <div className={cartao}><p className="text-sm text-marfim-2">Nenhum jogo no ar agora. Quando começar, ele aparece aqui e no telão.</p></div>}

      {adm && d.admin && <section className={`${cartao} space-y-6`}>
        <p className="kicker">Painel de quem organiza</p>

        <div className="space-y-3">
          <h3 className="display flex items-center gap-2 text-xl"><Users size={18} strokeWidth={1.5} /> Times</h3>
          <p className="text-sm text-marfim-2">{d.admin.presentes.length} pessoas na festa. Os times são sorteados entre elas.</p>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-primary" disabled={busy} onClick={() => void acao('times_criar', {}, 'Times sorteados!')}><Shuffle size={18} /> {d.times.length ? 'Refazer times' : 'Criar 2 times'}</button>
            <button className="btn btn-ghost" disabled={busy || d.times.length === 0} onClick={() => void acao('times_mostrar')}><Swords size={18} /> Placar no telão</button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="display flex items-center gap-2 text-xl"><Drama size={18} strokeWidth={1.5} /> Mímica e desenho</h3>
          <div className="grid grid-cols-2 gap-3">
            <select value={modo} onChange={(e) => setModo(e.target.value === 'desenho' ? 'desenho' : 'mimica')} className="min-h-11 rounded-xl border border-linha bg-carvao px-3 text-sm">
              <option value="mimica">Mímica</option><option value="desenho">Desenho</option>
            </select>
            <select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} className="min-h-11 rounded-xl border border-linha bg-carvao px-3 text-sm">
              {[30, 45, 60, 90, 120].map((s) => <option key={s} value={s}>{s} segundos</option>)}
            </select>
          </div>
          <button className="btn btn-primary w-full" disabled={busy || d.times.length === 0} onClick={() => void acao('mimica_iniciar', { modo, duracao_s: duracao })}><Play size={18} /> Sortear quem joga e iniciar</button>
          {d.times.length === 0 && <p className="text-xs text-marfim-2">Crie os times primeiro.</p>}
        </div>

        <div className="space-y-3">
          <h3 className="display flex items-center gap-2 text-xl"><Baby size={18} strokeWidth={1.5} /> Quem é o bebê?</h3>
          <select value={respostaId} onChange={(e) => setRespostaId(e.target.value)} className="min-h-11 w-full rounded-xl border border-linha bg-carvao px-3 text-sm">
            <option value="">Quem é o bebê da foto?</option>
            {d.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={(e) => void enviarFoto(e.target.files?.[0])} />
          <button className="btn btn-primary w-full" disabled={busy || enviandoFoto} onClick={() => arquivo.current?.click()}><Camera size={18} /> {enviandoFoto ? 'Enviando...' : 'Escolher foto e colocar no ar'}</button>
        </div>

        <div className="space-y-3">
          <h3 className="display flex items-center gap-2 text-xl"><Gift size={18} strokeWidth={1.5} /> Roleta de prendas</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-ghost" disabled={busy} onClick={() => void acao('roleta_iniciar')}>Mostrar roleta</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void acao('roleta_girar')}><RotateCw size={18} /> Girar</button>
          </div>
          <details className="rounded-xl border border-linha p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm text-marfim-2">Editar prendas ({d.admin.prendas.length})</summary>
            <textarea rows={10} value={prendasTexto ?? d.admin.prendas.join('\n')} onChange={(e) => setPrendasTexto(e.target.value)}
              className="mt-2 w-full rounded-xl border border-linha bg-carvao p-3 text-sm" aria-label="Uma prenda por linha" />
            <p className="mt-1 text-xs text-marfim-2">Uma prenda por linha (mínimo 3, até 80 letras cada).</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button className="btn btn-primary" disabled={busy} onClick={async () => { await acao('prendas_salvar', { prendas: (prendasTexto ?? d.admin!.prendas.join('\n')).split('\n').map((l) => l.trim()).filter(Boolean) }, 'Prendas salvas.'); setPrendasTexto(null); }}>Salvar</button>
              <button className="btn btn-ghost" disabled={busy} onClick={async () => { await acao('prendas_salvar', { prendas: [] }, 'Prendas padrão de volta.'); setPrendasTexto(null); }}>Restaurar padrão</button>
            </div>
          </details>
        </div>

        <button className="btn btn-ghost w-full" disabled={busy || !d.ativo} onClick={() => void acao('encerrar', {}, 'Jogo encerrado.')}><Square size={18} /> Encerrar jogo no telão</button>
      </section>}
    </div>
  </>;
}
