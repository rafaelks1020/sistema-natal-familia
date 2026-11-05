import { HttpError, ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { lerId, recursoDisponivel, registrarSemFalhar } from '@/app/lib/admin/consulta';
import { ACOES } from '@/app/lib/admin/acoes';

type Context = { params: Promise<{ recurso: string; id: string }> };

export const POST = route<Context>(async (req, { params }) => {
  const me = await requireAdmin();
  const { recurso, id } = await params;
  const r = await recursoDisponivel(recurso);
  const alvo = lerId(r, id);
  const { acao } = await readJson<{ acao?: unknown }>(req);
  const def = typeof acao === 'string' ? r.acoes.find((a) => a.id === acao) : undefined;
  const executar = def ? ACOES[`${r.id}:${def.id}`] : undefined;
  if (!def || !executar) throw new HttpError(400, 'Ação inválida para esta área.');
  const resultado = await executar({ id: alvo, me, recurso: r });
  await registrarSemFalhar(me, def.id, r.id, alvo, resultado.detalhe ?? null);
  const resposta = ok({
    ok: true,
    ...(resultado.mensagem ? { mensagem: resultado.mensagem } : {}),
    ...(resultado.senha_temporaria ? { senha_temporaria: resultado.senha_temporaria } : {}),
  });
  resposta.headers.set('Cache-Control', 'no-store');
  return resposta;
});
