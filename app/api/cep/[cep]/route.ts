import { HttpError, ok, requireUser, route } from '@/app/lib/api';

// GET /api/cep/<8 dígitos> -> { logradouro, bairro, cidade, uf } pela BrasilAPI (preenche o endereço do pagador).
export const GET = route<{ params: Promise<{ cep: string }> }>(async (_req, { params }) => {
  await requireUser();
  const cep = (await params).cep.replace(/\D/g, '');
  if (!/^\d{8}$/.test(cep)) throw new HttpError(400, 'CEP precisa ter 8 números.');
  const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
    headers: { 'User-Agent': 'NatalEmFamilia/1.0' },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (!res || !res.ok) throw new HttpError(404, 'CEP não encontrado. Preencha o endereço à mão.');
  const d = await res.json();
  return ok({ logradouro: d.street ?? '', bairro: d.neighborhood ?? '', cidade: d.city ?? '', uf: d.state ?? '' });
});
