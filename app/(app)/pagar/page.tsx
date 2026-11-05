'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Check, Copy, FileText, Lock, RefreshCw } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import LoopMedia from '@/app/ui/LoopMedia';
import { api, brl } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';

interface Payment {
  reference: string;
  amount: number;
  status: string;
  paid: boolean;
  pix_copia_cola: string | null;
  linha_digitavel: string | null;
  due_date: string | null;
  paid_at: string | null;
}
interface Situacao {
  enabled: boolean;
  amount: number;
  participant_paid: boolean;
  paid_date: string | null;
  payment: Payment | null;
  billing: {
    cpf_masked: string | null;
    has_cpf: boolean;
    address: { logradouro?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string } | null;
  };
}

const ABERTO = (p: Payment | null) => !!p && !['PAID', 'CANCELED', 'CANCELLED', 'EXPIRED', 'SUBSTITUIDO'].includes(p.status);
// Dia de hoje em Brasília (o vencimento do C6 é por dia de São Paulo, não UTC).
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const vencido = (p: Payment | null) => !!p?.due_date && p.due_date < hojeSP();

function fmtCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
const fmtCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
const fmtDia = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

export default function PagarPage() {
  const me = useMe();
  const toast = useToast();
  const [s, setS] = useState<Situacao | null>(null);
  const [erro, setErro] = useState('');
  const [trocando, setTrocando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setS(await api<Situacao>('/api/pagamento'));
      setErro('');
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    api<Situacao>('/api/pagamento')
      .then((d) => vivo && setS(d))
      .catch((e) => vivo && setErro((e as Error).message));
    return () => {
      vivo = false;
    };
  }, []);

  // Enquanto houver Pix em aberto e a tela estiver visível, confere o banco a cada 8 s.
  const aberto = ABERTO(s?.payment ?? null) && !s?.participant_paid;
  useEffect(() => {
    if (!aberto) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') carregar();
    }, 8000);
    return () => clearInterval(t);
  }, [aberto, carregar]);

  const pagoAgora = useRef(false);
  useEffect(() => {
    if (s?.participant_paid && aberto === false && pagoAgora.current) toast('Pagamento confirmado. Obrigado!');
  }, [s?.participant_paid, aberto, toast]);

  if (!me.participant_id) {
    return (
      <>
        <PageHeader kicker="Vaquinha" title="Contribuir" back="/vaquinha" />
        <p className="px-5 text-marfim-2">Seu acesso ainda não está ligado a um participante da vaquinha. Peça para quem organiza.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader kicker="Vaquinha da ceia" title="Contribuir" back="/vaquinha" />
      {erro && !s && (
        <div className="px-5">
          <p className="mb-4 text-marfim-2">{erro}</p>
          <button className="btn btn-ghost" onClick={carregar}><RefreshCw size={16} strokeWidth={1.5} /> Tentar de novo</button>
        </div>
      )}
      {!s && !erro && <Esqueleto />}
      {s && (
        s.participant_paid ? <Pago s={s} /> :
        !s.enabled ? <Desligado valor={s.amount} /> :
        aberto && !vencido(s.payment) && !trocando ? (
          <PixAberto p={s.payment!} onConferir={() => { pagoAgora.current = true; return carregar(); }} onTrocar={() => setTrocando(true)} />
        ) : (
          <Formulario s={s} onGerado={(p) => { pagoAgora.current = true; setTrocando(false); setS({ ...s, payment: p }); }} />
        )
      )}
    </>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-3 px-5">
      {[180, 64, 64].map((h, i) => (
        <div key={i} className="animate-pulse rounded-2xl bg-carvao-2" style={{ height: h }} />
      ))}
    </div>
  );
}

function Desligado({ valor }: { valor: number }) {
  return (
    <section className="rise px-5">
      <div className="surface p-6">
        <p className="kicker mb-3">Em breve</p>
        <p className="display text-3xl">Pagamento pelo app</p>
        <p className="mt-3 text-marfim-2">
          A contribuição é de <span className="numeral text-marfim">{brl(valor)}</span>. Enquanto o Pix pelo app não é ligado,
          combine com quem organiza.
        </p>
      </div>
    </section>
  );
}

function Pago({ s }: { s: Situacao }) {
  const [festa, setFesta] = useState(true);
  return (
    <section className="rise px-5">
      <div className="surface relative overflow-hidden p-7 text-center">
        {festa && (
          <LoopMedia name="mn-confete" once onEnded={() => setFesta(false)} className="absolute inset-0 h-full w-full opacity-60" />
        )}
        <div className="relative">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-champagne/60 text-champagne">
            <Check size={28} strokeWidth={1.5} />
          </span>
          <p className="kicker mb-2">Contribuição confirmada</p>
          <p className="display text-4xl">Obrigado!</p>
          <p className="mt-3 text-marfim-2">
            {s.paid_date ? <>Recebido em {fmtDia(s.paid_date)}.</> : <>Seu nome já está na lista de quem pagou.</>}
          </p>
          <Link href="/vaquinha" className="btn btn-ghost mt-7">Ver a vaquinha</Link>
        </div>
      </div>
    </section>
  );
}

function PixAberto({ p, onConferir, onTrocar }: { p: Payment; onConferir: () => Promise<void>; onTrocar: () => void }) {
  const toast = useToast();
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [conferindo, setConferindo] = useState(false);

  useEffect(() => {
    if (!p.pix_copia_cola) return;
    QRCode.toDataURL(p.pix_copia_cola, { margin: 1, width: 560, color: { dark: '#171b18', light: '#f3ebdc' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [p.pix_copia_cola]);

  async function copiar(texto: string, msg: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast(msg);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast('Não deu para copiar. Segure no código e copie à mão.', 'erro');
    }
  }

  return (
    <section className="stagger space-y-4 px-5">
      <div className="surface p-6 text-center">
        <p className="kicker mb-2">Pix da vaquinha</p>
        <p className="numeral text-5xl">{brl(p.amount)}</p>
        {p.due_date && <p className="mt-2 text-sm text-marfim-3">Vale até {fmtDia(p.due_date)}</p>}

        {p.pix_copia_cola ? (
          <>
            <button
              onClick={() => copiar(p.pix_copia_cola!, 'Código Pix copiado. Cole no app do seu banco.')}
              className="btn btn-primary mt-6 w-full"
            >
              {copiado ? <Check size={18} strokeWidth={1.8} /> : <Copy size={18} strokeWidth={1.8} />}
              {copiado ? 'Copiado' : 'Copiar código Pix'}
            </button>
            <p className="mt-3 text-xs text-marfim-3">Abra o app do seu banco, escolha Pix Copia e Cola e cole o código.</p>
            {qr && (
              <details className="mt-5 text-left">
                <summary className="cursor-pointer text-center text-sm text-marfim-2 underline decoration-linha-forte underline-offset-4">
                  Pagar de outro celular (QR Code)
                </summary>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR Code do Pix" className="fade-in mx-auto mt-4 w-56 rounded-xl" />
              </details>
            )}
          </>
        ) : (
          <p className="mt-6 text-marfim-2">O banco ainda está registrando o Pix. Em instantes ele aparece aqui.</p>
        )}
      </div>

      <div className="surface flex items-center gap-3 p-4">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-champagne opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-champagne" />
        </span>
        <p className="flex-1 text-sm text-marfim-2">Aguardando o pagamento. Esta tela confirma sozinha.</p>
        <button
          className="btn-quiet btn text-sm"
          disabled={conferindo}
          onClick={async () => { setConferindo(true); await onConferir(); setConferindo(false); }}
        >
          <RefreshCw size={15} strokeWidth={1.5} className={conferindo ? 'animate-spin' : ''} /> Já paguei
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-sm text-marfim-2">
        {p.linha_digitavel && (
          <button onClick={() => copiar(p.linha_digitavel!, 'Linha do boleto copiada.')} className="underline decoration-linha-forte underline-offset-4">
            Copiar linha do boleto
          </button>
        )}
        <a href="/api/pagamento/pdf" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline decoration-linha-forte underline-offset-4">
          <FileText size={14} strokeWidth={1.5} /> Boleto em PDF
        </a>
        <button onClick={onTrocar} className="underline decoration-linha-forte underline-offset-4">
          Trocar o valor
        </button>
      </div>
    </section>
  );
}

function Formulario({ s, onGerado }: { s: Situacao; onGerado: (p: Payment) => void }) {
  const toast = useToast();
  const a = s.billing.address ?? {};
  const [f, setF] = useState({
    cpf: '',
    cep: a.cep ? fmtCep(a.cep) : '',
    logradouro: a.logradouro ?? '',
    numero: a.numero ?? '',
    bairro: a.bairro ?? '',
    cidade: a.cidade ?? '',
    uf: a.uf ?? '',
  });
  const sugestoes = [s.amount, s.amount * 2, s.amount * 3];
  const [valor, setValor] = useState<number>(s.payment && s.payment.amount >= s.amount ? s.payment.amount : s.amount);
  const [outro, setOutro] = useState('');
  const [busy, setBusy] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const numeroRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, fmt?: (v: string) => string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((x) => ({ ...x, [k]: fmt ? fmt(e.target.value) : e.target.value }));

  async function buscarCep(cep: string) {
    const d = cep.replace(/\D/g, '');
    if (d.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await api<{ logradouro: string; bairro: string; cidade: string; uf: string }>(`/api/cep/${d}`);
      setF((x) => ({ ...x, logradouro: r.logradouro || x.logradouro, bairro: r.bairro || x.bairro, cidade: r.cidade || x.cidade, uf: r.uf || x.uf }));
      numeroRef.current?.focus();
    } catch {
      /* preenche à mão */
    } finally {
      setBuscandoCep(false);
    }
  }

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ payment: Payment }>('/api/pagamento', { method: 'POST', json: { ...f, valor } });
      setBusy(false);
      onGerado(r.payment);
    } catch (err) {
      toast((err as Error).message, 'erro');
      setBusy(false);
    }
  }

  return (
    <section className="rise px-5">
      <div className="mb-6 flex items-baseline justify-between border-b border-linha pb-5">
        <div>
          <p className="kicker mb-1">Sua parte</p>
          <p className="text-sm text-marfim-2">Pix com confirmação automática</p>
        </div>
        <p className="numeral text-4xl">{brl(valor)}</p>
      </div>

      <fieldset className="mb-6">
        <legend className="mb-3 text-sm text-marfim-2">
          Quanto você quer dar? <span className="text-marfim-3">(mínimo {brl(s.amount)})</span>
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {sugestoes.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setValor(v); setOutro(''); }}
              aria-pressed={valor === v && !outro}
              className={`btn px-2 text-sm ${valor === v && !outro ? 'btn-primary' : 'btn-ghost'}`}
            >
              {brl(v).replace(',00', '')}
            </button>
          ))}
          <input
            className={`field px-3 text-center text-sm ${outro ? 'border-champagne' : ''}`}
            inputMode="decimal"
            placeholder="Outro"
            aria-label="Outro valor"
            value={outro}
            onChange={(e) => {
              const t = e.target.value.replace(/[^\d,]/g, '').slice(0, 8);
              setOutro(t);
              const n = Number(t.replace(',', '.'));
              if (Number.isFinite(n) && n > 0) setValor(Math.round(n * 100) / 100);
            }}
          />
        </div>
        {valor < s.amount && <p className="mt-2 text-xs text-[#ff8a8d]">O mínimo é {brl(s.amount)}.</p>}
      </fieldset>

      {vencido(s.payment) && <p className="mb-4 text-sm text-marfim-2">O Pix anterior venceu. Gere um novo abaixo.</p>}

      <form onSubmit={gerar} className="space-y-3">
        <p className="text-sm text-marfim-2">O banco pede CPF e endereço de quem paga. Fica guardado só para os próximos pagamentos.</p>
        <input
          className="field"
          inputMode="numeric"
          placeholder={s.billing.has_cpf ? `CPF (salvo: ${s.billing.cpf_masked})` : 'CPF'}
          value={f.cpf}
          onChange={set('cpf', fmtCpf)}
          required={!s.billing.has_cpf}
        />
        <div className="relative">
          <input
            className="field"
            inputMode="numeric"
            placeholder="CEP"
            value={f.cep}
            onChange={(e) => { const v = fmtCep(e.target.value); setF((x) => ({ ...x, cep: v })); buscarCep(v); }}
            required
          />
          {buscandoCep && <RefreshCw size={16} strokeWidth={1.5} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-marfim-3" />}
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <input className="field" placeholder="Rua" value={f.logradouro} onChange={set('logradouro')} required />
          <input ref={numeroRef} className="field" placeholder="Nº" value={f.numero} onChange={set('numero')} required />
        </div>
        <input className="field" placeholder="Bairro" value={f.bairro} onChange={set('bairro')} required />
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <input className="field" placeholder="Cidade" value={f.cidade} onChange={set('cidade')} required />
          <input className="field uppercase" placeholder="UF" maxLength={2} value={f.uf} onChange={set('uf', (v) => v.toUpperCase().replace(/[^A-Z]/g, ''))} required />
        </div>
        <button type="submit" disabled={busy || valor < s.amount} className="btn btn-primary mt-2 w-full">
          {busy ? 'Gerando o Pix…' : `Gerar Pix de ${brl(valor)}`}
        </button>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-marfim-3">
          <Lock size={12} strokeWidth={1.5} /> Pagamento pelo C6 Bank, confirmado direto com o banco
        </p>
      </form>
    </section>
  );
}
