import { HttpError, ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { parseMomento } from '../momentos';
import { controlarPlayer, lerPlayer, registrarTelao, tokenDoPlayer } from '../_service';

const semCache = <T extends Response>(res: T): T => { res.headers.set('Cache-Control', 'no-store'); return res; };

/**
 * Token do Web Playback SDK (é o token da conta do organizador: SÓ admin) e estado do player.
 * ?parte=token devolve só o token, ?parte=estado só o estado; sem parâmetro, os dois.
 * Resposta: { access_token, expira_em } ou { precisa_reconectar: true }, mais { estado } quando pedido.
 */
export const GET = route(async req => {
  await requireAdmin();
  const parte = new URL(req.url).searchParams.get('parte');
  const [tk, estado] = await Promise.all([
    parte === 'estado' ? null : tokenDoPlayer(),
    parte === 'token' ? null : lerPlayer(),
  ]);
  return semCache(ok({ ...(tk || {}), ...(estado ? { estado } : {}) }));
});

type Corpo = { acao?: unknown; device_id?: unknown; momento?: unknown; valor?: unknown; ligado?: unknown };

export const POST = route(async req => {
  await requireAdmin();
  const b = await readJson<Corpo>(req);
  switch (b.acao) {
    case 'registrar': {
      const reg = await registrarTelao(b.device_id);
      // Passa a reprodução para o telão (sem tocar nada). Se o Spotify ainda não enxergar o aparelho, o registro vale mesmo assim.
      const transf = await controlarPlayer('transferir', { device_id: reg.device_id }).catch(() => null);
      return semCache(ok({ ok: true, transferido: Boolean(transf && 'ok' in transf), ...(transf && 'precisa_reconectar' in transf ? { precisa_reconectar: true } : {}) }));
    }
    case 'tocar': {
      const momento = parseMomento(b.momento);
      if (!momento) throw new HttpError(400, 'Momento inválido.');
      return semCache(ok(await controlarPlayer('tocar', { momento })));
    }
    case 'pausar': case 'continuar': case 'proxima': case 'anterior':
      return semCache(ok(await controlarPlayer(b.acao)));
    case 'volume': {
      const valor = Number(b.valor);
      if (b.valor === null || b.valor === '' || !Number.isFinite(valor)) throw new HttpError(400, 'Volume inválido.');
      return semCache(ok(await controlarPlayer('volume', { valor })));
    }
    case 'aleatorio':
      if (typeof b.ligado !== 'boolean') throw new HttpError(400, 'Informe se o modo aleatório fica ligado.');
      return semCache(ok(await controlarPlayer('aleatorio', { ligado: b.ligado })));
    default:
      throw new HttpError(400, 'Ação inválida.');
  }
});
