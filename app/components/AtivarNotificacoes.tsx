'use client';

import { useEffect, useState } from 'react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import {
  modoPush,
  urlBase64ParaBytes,
  type AmbientePush,
  type ModoPush,
} from '@/app/lib/push-web';

const DISPENSA = 'nf_push_banner';
const TEXTO_IPHONE = 'Toque em Compartilhar e Adicionar à Tela de Início, depois abra por lá e ative.';

type Vista = {
  modo: ModoPush;
  chave: string | null;
  permissao: NotificationPermission | 'unsupported';
  inscrito: boolean;
  dispensado: boolean;
};

function lerAmbiente(): AmbientePush {
  const nav = navigator as Navigator & { standalone?: boolean };
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  const ua = navigator.userAgent || '';
  return {
    userAgent: ua,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    platform: navigator.platform || '',
    // O app nativo é React Native, sem WebView. Se o site abrir numa casca, o push nativo já cobre.
    capacitorNativo: Boolean(cap?.isNativePlatform?.()) || /Capacitor/i.test(ua),
    reactNativeWebView: Boolean((window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView),
    standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    temServiceWorker: 'serviceWorker' in navigator,
    temPushManager: 'PushManager' in window,
    temNotification: typeof Notification !== 'undefined',
  };
}

function rotaDoPush(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) return null;
  if (valor.length > 200) return null;
  return valor;
}

export default function AtivarNotificacoes({ modo: apresentacao }: { modo: 'banner' | 'fixo' }) {
  const toast = useToast();
  const [vista, setVista] = useState<Vista | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let vivo = true;
    const ouvir = (event: MessageEvent) => {
      const dados = event.data as { tipo?: unknown; rota?: unknown } | null;
      if (!dados || dados.tipo !== 'push-rota') return;
      const rota = rotaDoPush(dados.rota);
      if (!rota) return;
      const atual = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (atual !== rota) window.location.assign(rota);
    };
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', ouvir);

    const ambiente = lerAmbiente();
    const modo = modoPush(ambiente);
    if (modo === 'oculto') {
      setVista({ modo, chave: null, permissao: 'unsupported', inscrito: false, dispensado: false });
      return () => {
        vivo = false;
        navigator.serviceWorker?.removeEventListener('message', ouvir);
      };
    }

    void (async () => {
      let chave: string | null = null;
      try {
        const resposta = await api<{ chavePublica: string | null }>('/api/push/web');
        chave = resposta.chavePublica;
      } catch { chave = null; }
      let inscrito = false;
      const permissao: NotificationPermission | 'unsupported' = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
      if (chave && permissao === 'granted' && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration('/sw.js');
          const sub = await reg?.pushManager.getSubscription();
          if (sub) {
            await api('/api/push/web', { method: 'POST', json: sub.toJSON() });
            inscrito = true;
          }
        } catch { /* a tela segue com o que o navegador sabe */ }
      }
      if (!vivo) return;
      const dispensado = apresentacao === 'banner' && window.localStorage.getItem(DISPENSA) === '1';
      setVista({ modo, chave, permissao, inscrito, dispensado });
    })();

    return () => {
      vivo = false;
      navigator.serviceWorker?.removeEventListener('message', ouvir);
    };
  }, [apresentacao]);

  async function ativar() {
    if (!vista?.chave || vista.modo !== 'pronto') return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setVista({ ...vista, permissao: perm, inscrito: false });
        toast(perm === 'denied' ? 'As notificações ficaram bloqueadas neste navegador.' : 'Sem a permissão, o aviso não chega.', 'erro');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const bytes = urlBase64ParaBytes(vista.chave);
      if (!bytes) throw new Error('Chave de aviso inválida.');
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      }
      try {
        await api('/api/push/web', { method: 'POST', json: sub.toJSON() });
      } catch (err) {
        await sub.unsubscribe().catch(() => {});
        throw err;
      }
      setVista({ ...vista, permissao: 'granted', inscrito: true, dispensado: false });
      toast('Notificações ativadas.');
    } catch (err) {
      toast((err as Error).message || 'Não foi possível ativar.', 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function desativar() {
    if (!vista) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api('/api/push/web', { method: 'DELETE', json: sub.toJSON() });
        await sub.unsubscribe();
      }
      setVista({ ...vista, inscrito: false });
      toast('Notificações desativadas neste navegador.');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  if (!vista || vista.modo === 'oculto') return null;
  if (apresentacao === 'banner' && (vista.dispensado || vista.inscrito || vista.modo === 'sem-suporte')) return null;
  if (apresentacao === 'banner' && vista.modo === 'pronto' && !vista.chave) return null;

  if (apresentacao === 'fixo') {
    return (
      <section className="surface space-y-3 p-5" aria-labelledby="avisos-navegador">
        <h2 id="avisos-navegador" className="kicker">Avisos neste navegador</h2>
        {corpo(vista, busy, ativar, desativar)}
      </section>
    );
  }

  return (
    <div className="px-5 pt-4">
      <div className="rounded-2xl border border-linha bg-carvao-2 px-4 py-3">
        {corpo(vista, busy, ativar, desativar)}
        <button
          type="button"
          className="btn btn-quiet mt-1 px-0"
          onClick={() => {
            window.localStorage.setItem(DISPENSA, '1');
            setVista({ ...vista, dispensado: true });
          }}
        >
          Agora não
        </button>
      </div>
    </div>
  );
}

function corpo(
  vista: Vista,
  busy: boolean,
  ativar: () => Promise<void>,
  desativar: () => Promise<void>,
) {
  if (vista.modo === 'iphone-instalar') {
    return <p className="text-sm leading-relaxed text-marfim-2">{TEXTO_IPHONE}</p>;
  }
  if (vista.modo === 'sem-suporte') {
    return <p className="text-sm text-marfim-2">Este navegador não recebe avisos. Use o aplicativo ou o Chrome.</p>;
  }
  if (!vista.chave) {
    return <p className="text-sm text-marfim-2">As notificações do site ainda não estão disponíveis.</p>;
  }
  if (vista.permissao === 'denied') {
    return <p className="text-sm text-marfim-2">As notificações estão bloqueadas neste navegador. Libere nas configurações do site para ativar.</p>;
  }
  if (vista.inscrito) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-marfim-2">Notificações ativadas neste navegador.</p>
        <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => { void desativar(); }}>
          {busy ? 'Desativando...' : 'Desativar notificações'}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-marfim-2">Ative para receber os avisos da família também neste navegador.</p>
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => { void ativar(); }}>
        {busy ? 'Ativando...' : 'Ativar notificações'}
      </button>
    </div>
  );
}
