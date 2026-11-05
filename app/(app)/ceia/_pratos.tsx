'use client';

import { useState } from 'react';
import ModerationActions from '../mural/_components/ModerationActions';
import {
  avisoPratos,
  CATEGORIAS,
  quemLeva,
  rotuloCategoria,
  type CategoriaPrato,
  type CeiaPrato,
} from '@/app/api/ceia/tipos';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';

export function PratosCeia({ pratos, onPratos }: { pratos: CeiaPrato[]; onPratos: (pratos: CeiaPrato[]) => void }) {
  const me = useMe();
  const toast = useToast();
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaPrato>('salgado');
  const [quantidade, setQuantidade] = useState('');
  const [faltaNome, setFaltaNome] = useState('');
  const [faltaCategoria, setFaltaCategoria] = useState<CategoriaPrato>('salgado');
  const [faltaQuantidade, setFaltaQuantidade] = useState('');
  const [busy, setBusy] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const aviso = nome.trim().length >= 2 ? avisoPratos(pratos, nome, categoria) : null;
  const avisoFalta = faltaNome.trim().length >= 2 ? avisoPratos(pratos, faltaNome, faltaCategoria) : null;

  async function criar(preciso: boolean) {
    if (busy) return;
    const nomeEnvio = (preciso ? faltaNome : nome).trim();
    const categoriaEnvio = preciso ? faltaCategoria : categoria;
    const quantidadeEnvio = (preciso ? faltaQuantidade : quantidade).trim();
    if (!nomeEnvio) {
      toast('Escreva o que vai para a mesa.', 'erro');
      return;
    }
    setBusy(true);
    try {
      const resp = await api<{ prato: CeiaPrato; aviso: string | null }>('/api/ceia/pratos', {
        method: 'POST',
        json: { nome: nomeEnvio, categoria: categoriaEnvio, quantidade: quantidadeEnvio, preciso },
      });
      onPratos([...pratos, resp.prato]);
      if (preciso) {
        setFaltaNome('');
        setFaltaQuantidade('');
      } else {
        setNome('');
        setQuantidade('');
      }
      toast(resp.aviso ? `Anotado. ${resp.aviso}` : 'Anotado na lista da ceia.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível anotar.', 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function acao(prato: CeiaPrato, tipo: 'assumir' | 'desistir' | 'apagar') {
    if (ocupado) return;
    if (tipo === 'apagar' && !window.confirm(`Apagar "${prato.nome}" da lista?`)) return;
    setOcupado(prato.id);
    try {
      if (tipo === 'apagar') {
        await api(`/api/ceia/pratos/${prato.id}`, { method: 'DELETE' });
        onPratos(pratos.filter((item) => item.id !== prato.id));
        toast('Item apagado.');
      } else {
        const atualizado = await api<CeiaPrato>(`/api/ceia/pratos/${prato.id}`, { method: 'POST', json: { acao: tipo } });
        onPratos(pratos.map((item) => item.id === atualizado.id ? atualizado : item));
        toast(tipo === 'assumir' ? 'Combinado, você leva.' : 'Tudo bem, outra pessoa pode levar.');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível atualizar.', 'erro');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section aria-labelledby="ceia-pratos">
      <p className="kicker mb-2">03 / Quem leva o quê</p>
      <h2 id="ceia-pratos" className="display text-3xl">A mesa</h2>
      <p className="mt-3 text-sm leading-relaxed text-marfim-2">Diga o que você leva, ou assuma algo que ainda está sem dono.</p>

      <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); void criar(false); }}>
        <label className="block text-sm text-marfim-2">Eu levo
          <input className="field mt-2" maxLength={80} value={nome} placeholder="Ex.: pavê, refrigerante, guardanapo" onChange={(event) => setNome(event.target.value)} />
        </label>
        {aviso ? <p className="text-sm text-champagne">{aviso} Pode levar mesmo assim.</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="min-w-0 text-sm text-marfim-2">Categoria
            <select className="field mt-2" value={categoria} onChange={(event) => setCategoria(event.target.value as CategoriaPrato)}>
              {CATEGORIAS.map((item) => <option key={item.id} value={item.id}>{item.rotulo}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-sm text-marfim-2">Quantidade
            <input className="field mt-2" maxLength={40} value={quantidade} placeholder="Ex.: 2 travessas" onChange={(event) => setQuantidade(event.target.value)} />
          </label>
        </div>
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Anotando...' : 'Eu levo'}</button>
      </form>

      {me.is_admin ? (
        <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void criar(true); }}>
          <label className="block text-sm text-marfim-2">Precisamos de
            <input className="field mt-2" maxLength={80} value={faltaNome} placeholder="Ex.: gelo, copos, arroz" onChange={(event) => setFaltaNome(event.target.value)} />
          </label>
          {avisoFalta ? <p className="text-sm text-champagne">{avisoFalta}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 text-sm text-marfim-2">Categoria
              <select className="field mt-2" value={faltaCategoria} onChange={(event) => setFaltaCategoria(event.target.value as CategoriaPrato)}>
                {CATEGORIAS.map((item) => <option key={item.id} value={item.id}>{item.rotulo}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-sm text-marfim-2">Quantidade
              <input className="field mt-2" maxLength={40} value={faltaQuantidade} placeholder="Ex.: 1 pacote" onChange={(event) => setFaltaQuantidade(event.target.value)} />
            </label>
          </div>
          <button className="btn btn-ghost w-full" disabled={busy}>Anunciar o que falta</button>
        </form>
      ) : null}

      <div className="mt-8 space-y-8">
        {pratos.length ? CATEGORIAS.map((grupo) => {
          const itens = pratos
            .filter((prato) => prato.categoria === grupo.id)
            .sort((a, b) => Number(Boolean(a.responsavel_id)) - Number(Boolean(b.responsavel_id)) || a.nome.localeCompare(b.nome, 'pt-BR'));
          if (!itens.length) return null;
          return (
            <div key={grupo.id}>
              <h3 className="kicker mb-3">{rotuloCategoria(grupo.id)} ({itens.length})</h3>
              <ul className="space-y-3">
                {itens.map((prato) => (
                  <li key={prato.id} className="surface min-w-0 px-4 py-3">
                    <p className="break-words text-marfim">{prato.nome}</p>
                    {prato.quantidade ? <p className="mt-1 text-sm text-marfim-3">{prato.quantidade}</p> : null}
                    <p className="mt-1 text-sm text-marfim-2">{quemLeva(prato, me.id)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!prato.responsavel_id ? (
                        <button type="button" className="btn btn-primary px-4" disabled={ocupado === prato.id} onClick={() => { void acao(prato, 'assumir'); }}>Eu levo</button>
                      ) : null}
                      {prato.responsavel_id === me.id ? (
                        <button type="button" className="btn btn-ghost px-4" disabled={ocupado === prato.id} onClick={() => { void acao(prato, 'desistir'); }}>Desistir</button>
                      ) : null}
                      {prato.user_id === me.id || me.is_admin ? (
                        <button type="button" className="btn btn-quiet px-4" disabled={ocupado === prato.id} onClick={() => { void acao(prato, 'apagar'); }}>Apagar</button>
                      ) : null}
                    </div>
                    {prato.user_id !== me.id ? (
                      <details className="mt-2">
                        <summary className="min-h-11 cursor-pointer py-2 text-sm text-marfim-3">Denunciar ou bloquear</summary>
                        <ModerationActions userId={prato.user_id} name={prato.autor_nome} alvoTipo="prato" alvoId={prato.id} />
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        }) : <p className="text-sm text-marfim-2">A lista ainda está vazia. Se for levar algo, avise a família.</p>}
      </div>
    </section>
  );
}
