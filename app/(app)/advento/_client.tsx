'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { CalendarioAdvento, JanelaGrade, TipoAdvento } from '@/app/lib/advento';
import LoopMedia from '@/app/ui/LoopMedia';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import PainelDia from './_painel';

const ROTULO: Record<TipoAdvento, string> = {
  foto: 'Foto',
  receita: 'Receita',
  enquete: 'Enquete',
  desafio: 'Desafio',
  pergunta: 'Pergunta',
};

function dois(n: number): string {
  return String(n).padStart(2, '0');
}

function faltaPara(abreEm: string, agora: number) {
  const total = Math.max(0, new Date(abreEm).getTime() - agora);
  const seg = Math.floor(total / 1000);
  return {
    total,
    dias: Math.floor(seg / 86400),
    horas: Math.floor((seg % 86400) / 3600),
    minutos: Math.floor((seg % 3600) / 60),
    segundos: seg % 60,
  };
}

function Contagem({ abreEm, onAcabou }: { abreEm: string; onAcabou: () => void }) {
  const [agora, setAgora] = useState(() => Date.now());
  const avisar = useRef(onAcabou);
  useEffect(() => { avisar.current = onAcabou; }, [onAcabou]);
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const falta = faltaPara(abreEm, agora);
  const zerou = falta.total <= 0;
  useEffect(() => {
    if (!zerou) return;
    avisar.current();
    const id = setInterval(() => avisar.current(), 15000);
    return () => clearInterval(id);
  }, [zerou]);
  const partes = [
    ['dias', falta.dias],
    ['horas', dois(falta.horas)],
    ['min', dois(falta.minutos)],
    ['seg', dois(falta.segundos)],
  ] as const;
  return (
    <section className="surface relative mb-6 overflow-hidden p-5" aria-label="Contagem até o dia 1º de dezembro">
      <div className="mb-4 flex items-center gap-4">
        <div className="h-14 w-14 shrink-0">
          <LoopMedia name="mn-countdown" className="h-full w-full" fallback={<span className="display block text-center text-2xl text-champagne">1</span>} />
        </div>
        <div className="min-w-0">
          <p className="kicker">Até 1º de dezembro</p>
          <h2 className="display mt-1 text-[1.7rem] text-marfim">O calendário ainda está fechado</h2>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-marfim-2">
        Na meia-noite do dia 1º, a primeira janela abre para a família. As outras esperam o dia delas.
      </p>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {partes.map(([nome, valor]) => (
          <div key={nome} className="rounded-[14px] border border-linha bg-carvao-3 px-1 py-3 text-center">
            <span className="numeral block text-[1.7rem] leading-none text-marfim">{valor}</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-marfim-3">{nome}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function classePorta(janela: JanelaGrade, hoje: number | null): string {
  if (janela.respondida) return 'border-champagne bg-carvao-3 text-champagne';
  if (janela.abriu) return 'border-champagne/70 bg-carvao-3 text-marfim';
  if (janela.dia === hoje) return 'border-cereja bg-carvao-2 text-marfim';
  if (janela.liberada) return 'border-champagne/40 bg-carvao-2 text-marfim';
  return 'border-linha bg-carvao-2/50 text-marfim-3';
}

function frasePorta(janela: JanelaGrade, hoje: number | null, antes: boolean, organizador: boolean): string {
  const base = `Janela ${janela.dia}`;
  if (!janela.liberada) {
    if (organizador) return `${base}, ainda fechada para a família, você pode preparar`;
    return antes ? `${base}, abre no dia 1º de dezembro` : `${base}, abre no dia ${janela.dia} de dezembro`;
  }
  const extra = janela.respondida ? ', você já respondeu' : janela.abriu ? ', você já abriu' : '';
  const hojeTxt = janela.dia === hoje ? ', hoje' : '';
  return `${base}, aberta${hojeTxt}${extra}`;
}

export default function AdventoClient({ initial }: { initial: CalendarioAdvento }) {
  const toast = useToast();
  const [cal, setCal] = useState(initial);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [abrindo, setAbrindo] = useState<number | null>(null);
  const seguiu = useRef(false);

  const recarregar = useCallback(async () => {
    try {
      const novo = await api<CalendarioAdvento>('/api/advento');
      setCal(novo);
    } catch (error) {
      toast((error as Error).message, 'erro');
    }
  }, [toast]);

  const seguir = useCallback((dia: number) => {
    if (seguiu.current) return;
    seguiu.current = true;
    setAbrindo(null);
    setEscolhido(dia);
  }, []);

  useEffect(() => {
    if (abrindo == null) return;
    const id = setTimeout(() => seguir(abrindo), 900);
    return () => clearTimeout(id);
  }, [abrindo, seguir]);

  function pedir(janela: JanelaGrade) {
    if (abrindo != null) return;
    if (!janela.liberada && !cal.organizador) {
      toast(cal.fase === 'antes'
        ? 'O calendário abre à meia-noite do dia 1º de dezembro.'
        : `Esta janela abre no dia ${janela.dia} de dezembro.`);
      return;
    }
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzir) {
      setEscolhido(janela.dia);
      return;
    }
    seguiu.current = false;
    setAbrindo(janela.dia);
  }

  function marcarAberta(dia: number, respondida = false) {
    setCal((atual) => ({
      ...atual,
      janelas: atual.janelas.map((item) => item.dia === dia ? { ...item, abriu: true, respondida: respondida || item.respondida } : item),
    }));
  }

  const resumo = cal.janelas.find((item) => item.dia === escolhido) ?? null;

  return (
    <div className="overflow-x-hidden">
      <style>{`
        .advento-porta { transform-origin: left center; }
        .advento-abrindo { animation: advento-abrir 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes advento-abrir {
          0% { transform: perspective(720px) rotateY(0deg); }
          100% { transform: perspective(720px) rotateY(-90deg); }
        }
      `}</style>
      <PageHeader kicker={`Edição ${cal.ano}`} title="Advento" back="/ceia" />
      <div className="px-5 pb-8">
        {escolhido == null || !resumo ? (
          <>
            <p className="mb-5 text-sm leading-relaxed text-marfim-2">
              Uma portinha por dia, de 1 a 24 de dezembro. Toque para abrir. O visto marca o que você já respondeu.
            </p>
            {cal.fase === 'antes' && <Contagem abreEm={cal.abre_em} onAcabou={() => { void recarregar(); }} />}
            {cal.organizador && cal.fase === 'antes' && (
              <p className="mb-4 text-sm text-champagne">Você pode preparar as janelas antes. A família só vê cada uma no dia.</p>
            )}
            <ul className="grid grid-cols-4 gap-2" aria-label="Janelas de 1 a 24 de dezembro">
              {cal.janelas.map((janela) => (
                <li key={janela.dia} className="overflow-hidden rounded-[14px]">
                  <button
                    type="button"
                    onClick={() => pedir(janela)}
                    onAnimationEnd={(event) => {
                      if (event.target === event.currentTarget && abrindo === janela.dia) seguir(janela.dia);
                    }}
                    aria-label={frasePorta(janela, cal.dia_de_hoje, cal.fase === 'antes', cal.organizador)}
                    className={`advento-porta relative flex aspect-[3/4] min-h-11 w-full flex-col items-center justify-center border ${classePorta(janela, cal.dia_de_hoje)} ${abrindo === janela.dia ? 'advento-abrindo' : ''}`}
                  >
                    <span className="display text-[1.65rem] leading-none">{janela.dia}</span>
                    {janela.dia === cal.dia_de_hoje && !janela.respondida && (
                      <span className="kicker mt-1 text-[8px] tracking-[0.14em]">Hoje</span>
                    )}
                    {janela.abriu && janela.tipo && (
                      <span className="mt-1 max-w-full truncate px-1 text-[9px] uppercase tracking-[0.12em] text-marfim-3">{ROTULO[janela.tipo]}</span>
                    )}
                    {janela.personalizada && <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-champagne" aria-hidden />}
                    {janela.respondida && (
                      <Check className="absolute right-1 top-1 text-champagne" size={13} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <PainelDia
            key={escolhido}
            resumo={resumo}
            onVoltar={() => { seguiu.current = false; setEscolhido(null); }}
            onMudou={(dia) => {
              marcarAberta(dia.dia, dia.respondida);
              setCal((atual) => ({
                ...atual,
                janelas: atual.janelas.map((item) => item.dia !== dia.dia ? item : {
                  ...item,
                  abriu: true,
                  respondida: dia.respondida,
                  personalizada: dia.personalizada,
                  tipo: dia.tipo,
                  titulo: dia.titulo,
                  texto: dia.texto,
                  image_url: dia.image_url,
                  opcoes: dia.opcoes,
                }),
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}
