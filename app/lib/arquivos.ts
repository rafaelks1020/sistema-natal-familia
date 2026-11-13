import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { HttpError } from '@/app/lib/api';

// Armazenamento de arquivos grandes (fotos, vídeos, áudios, instrumentais): Storage Box da Hetzner (5 TB) atrás da VPS.
// Gravar: PUT numa URL assinada aqui (o serviço natal-arquivos na VPS confere a assinatura). Ler: público em /f/<caminho>, com cache longo.
// A chave vem do SESSION_SECRET (HMAC com rótulo próprio), então não há segredo novo para configurar. Trocar o SESSION_SECRET exige
// atualizar /home/rafael/natal-arquivos/env na VPS.
// Nada é sobrescrito: cada envio tem caminho único (o cache é "immutable").

export const BASE_ARQUIVOS = 'https://arquivos.natalemfamilia.com.br';
/** Endereço antigo (sslip), ainda servido pela VPS: aceito para apagar arquivos enviados antes da troca. */
const BASE_ANTIGA = 'https://natal.169-58-196-17.sslip.io';

function chave(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new HttpError(503, 'Armazenamento não configurado.');
  return createHmac('sha256', s).update('natal-arquivos-v1').digest();
}
const assinar = (texto: string) => createHmac('sha256', chave()).update(texto).digest('base64url');

/** Sufixo aleatório curto para nomes de arquivo. */
export const sufixo = () => randomBytes(5).toString('hex');

/** URL pública de leitura de um caminho. */
export const urlPublica = (caminho: string) => `${BASE_ARQUIVOS}/f/${caminho}`;

/** É uma URL do nosso armazenamento? Devolve o caminho, ou null. */
export function caminhoDaUrl(url: string): string | null {
  for (const base of [BASE_ARQUIVOS, BASE_ANTIGA]) if (url.startsWith(`${base}/f/`)) return url.slice(base.length + 3);
  return null;
}

/** URL assinada para enviar UM arquivo (PUT com o Content-Type igual a `tipo`, até `max` bytes), válida por `validadeS` segundos. */
export function urlDeEnvio(caminho: string, tipo: string, max: number, validadeS = 15 * 60): { uploadUrl: string; url: string; pathname: string } {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(caminho) || caminho.includes('..') || caminho.includes('//')) throw new Error(`caminho inválido: ${caminho}`);
  const exp = Math.floor(Date.now() / 1000) + validadeS;
  const s = assinar(`PUT\n${caminho}\n${tipo}\n${max}\n${exp}`);
  const q = new URLSearchParams({ p: caminho, t: tipo, max: String(max), exp: String(exp), s });
  return { uploadUrl: `${BASE_ARQUIVOS}/envio?${q}`, url: urlPublica(caminho), pathname: caminho };
}

/** Envia do próprio servidor (rotas que recebem multipart). Devolve a URL pública. */
export async function enviarArquivo(caminho: string, dados: Blob, tipo: string): Promise<string> {
  const { uploadUrl, url } = urlDeEnvio(caminho, tipo, dados.size, 5 * 60);
  const r = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': tipo }, body: dados, signal: AbortSignal.timeout(45_000) }).catch((e) => {
    console.error('[arquivos] envio falhou:', e instanceof Error ? e.name : 'erro');
    return null;
  });
  if (!r) throw new HttpError(502, 'O armazenamento demorou para responder. Tente de novo.');
  if (!r.ok) {
    console.error('[arquivos] envio recusado', r.status);
    throw new HttpError(502, 'Não consegui salvar o arquivo. Tente de novo.');
  }
  return url;
}

/** Apaga arquivos do nosso armazenamento (URLs de fora são ignoradas). Não lança: devolve quantos falharam. */
export async function apagarArquivos(urls: string[]): Promise<number> {
  let falhas = 0;
  for (const u of urls) {
    const p = caminhoDaUrl(u);
    if (!p) continue;
    const exp = Math.floor(Date.now() / 1000) + 300;
    const q = new URLSearchParams({ p, exp: String(exp), s: assinar(`DELETE\n${p}\n${exp}`) });
    try {
      const r = await fetch(`${BASE_ARQUIVOS}/apagar?${q}`, { method: 'DELETE', signal: AbortSignal.timeout(10_000) });
      if (!r.ok) falhas++;
    } catch { falhas++; }
  }
  return falhas;
}
