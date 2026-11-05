'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import LoopMedia from '@/app/ui/LoopMedia';
import { api } from '@/app/ui/client';

type Mode = 'login' | 'register';

// Igual ao servidor (app/api/auth/route.ts): mostra como o usuário vai ficar.
function normalizarUsuario(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.]+|[.]+$/g, '')
    .slice(0, 40);
}

// Fundo de reserva enquanto o vídeo mn-login não existe: bokeh dourado desenhado em CSS.
function Bokeh() {
  const dots = [
    [12, 18, 90, 0.35], [70, 12, 140, 0.25], [85, 40, 70, 0.4], [25, 55, 120, 0.2],
    [60, 70, 60, 0.45], [40, 30, 50, 0.3], [90, 80, 110, 0.2], [8, 85, 80, 0.3],
  ];
  return (
    <div className="absolute inset-0 overflow-hidden">
      {dots.map(([x, y, s, o], i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`, top: `${y}%`, width: s, height: s, opacity: o,
            background: 'radial-gradient(circle, rgba(232,196,128,0.9), rgba(191,165,119,0) 70%)',
            filter: 'blur(6px)',
            animation: `glow ${5 + (i % 4)}s ease-in-out ${i * 0.7}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function EntrarPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ name: '', username: '', password: '', code: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth', { method: 'POST', json: { action: mode, ...form } });
      window.location.href = '/';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-carvao">
      <div className="absolute inset-0">
        <LoopMedia name="mn-login" className="h-full w-full opacity-70" fallback={<Bokeh />} />
        <div className="absolute inset-0 bg-gradient-to-b from-carvao/30 via-carvao/50 to-carvao" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-end px-6 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-16">
        <div className="mb-10 text-center">
          <svg viewBox="0 0 40 56" className="fade-in mx-auto mb-5 h-14 w-10 text-champagne" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M20 2 L22 8 L28 8 L23 12 L25 18 L20 14 L15 18 L17 12 L12 8 L18 8 Z" />
            <path d="M20 20 C 10 30, 30 32, 14 40 C 30 42, 28 50, 8 54 M20 20 C 30 28, 12 34, 26 40" strokeLinecap="round" />
          </svg>
          <p className="kicker rise mb-3">Dezembro de 2026</p>
          <h1 className="display rise text-[3.4rem]" style={{ animationDelay: '0.08s' }}>
            Natal em
            <br />
            <span className="display-italic">Família</span>
          </h1>
          <div className="mx-auto mt-5 h-px w-16 bg-cereja" />
        </div>

        <form onSubmit={submit} className="rise space-y-3" style={{ animationDelay: '0.16s' }}>
          {mode === 'register' && (
            <input className="field" placeholder="Seu nome (como a família te chama)" autoComplete="name" value={form.name} onChange={set('name')} required />
          )}
          <input
            className="field"
            placeholder="Usuário"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={form.username}
            onChange={set('username')}
            required
          />
          {form.username.trim() && normalizarUsuario(form.username) !== form.username.trim() && (
            <p className="-mt-1 px-1 text-xs text-marfim-3">
              {mode === 'register' ? 'Seu usuário vai ficar: ' : 'Entrando como: '}
              <span className="text-champagne">{normalizarUsuario(form.username) || '...'}</span>
            </p>
          )}
          <div className="relative">
            <input
              className="field pr-12"
              type={show ? 'text' : 'password'}
              placeholder={mode === 'register' ? 'Senha (mínimo 6)' : 'Senha'}
              minLength={mode === 'register' ? 6 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={set('password')}
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-marfim-3"
            >
              {show ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
            </button>
          </div>
          {mode === 'register' && (
            <input
              className="field"
              placeholder="Código da família"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.code}
              onChange={set('code')}
              required
            />
          )}

          {error && <p role="alert" className="px-1 text-sm text-[#ff8a8d]">{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? 'Um instante…' : mode === 'login' ? 'Entrar' : 'Criar meu acesso'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          className="mt-6 text-center text-sm text-marfim-2"
        >
          {mode === 'login' ? (
            <>Primeira vez aqui? <span className="text-marfim underline decoration-cereja underline-offset-4">Cadastrar parente</span></>
          ) : (
            <>Já tenho acesso. <span className="text-marfim underline decoration-cereja underline-offset-4">Entrar</span></>
          )}
        </button>
      </div>
    </main>
  );
}
