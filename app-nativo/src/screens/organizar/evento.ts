import type { AjustesEvento } from '../../types/familia';

export interface CamposEvento {
  titulo: string;
  data: string;
  hora: string;
  local: string;
  valor: string;
}

export function mascaraData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

export function mascaraHora(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 4);
  if (digitos.length <= 2) return digitos;
  return `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

function partesNoFuso(instante: Date) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante);
  const pegar = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? '';
  const hora = pegar('hour') === '24' ? '00' : pegar('hour');
  return { ano: pegar('year'), mes: pegar('month'), dia: pegar('day'), hora, minuto: pegar('minute') };
}

export function camposDeEvento(iso: string): { data: string; hora: string } {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return { data: '', hora: '' };
  const fuso = partesNoFuso(instante);
  if (!fuso.ano || !fuso.mes || !fuso.dia) return { data: '', hora: '' };
  return { data: `${fuso.dia}/${fuso.mes}/${fuso.ano}`, hora: `${fuso.hora}:${fuso.minuto}` };
}

export function valorEmReais(valor: number): string {
  if (!Number.isFinite(valor)) return '';
  return valor.toFixed(2).replace('.', ',');
}

export function lerContribuicao(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(limpo)) return null;
  const valor = Number(limpo.replace(',', '.'));
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100) / 100;
}

/** Data e hora de Brasília viram um instante ISO com Z, no formato que PUT /api/settings aceita. */
export function isoDeBrasilia(data: string, hora: string): string | null {
  const dia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.trim());
  const horario = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora.trim());
  if (!dia || !horario) return null;
  const ano = dia[3];
  const mes = dia[2];
  const diaMes = dia[1];
  if (!ano || !mes || !diaMes) return null;
  const isoLocal = `${ano}-${mes}-${diaMes}T${horario[1]}:${horario[2]}:00-03:00`;
  const instante = new Date(isoLocal);
  if (Number.isNaN(instante.getTime())) return null;
  const fuso = partesNoFuso(instante);
  if (fuso.ano !== ano || fuso.mes !== mes || fuso.dia !== diaMes || fuso.hora !== horario[1] || fuso.minuto !== horario[2]) return null;
  return instante.toISOString();
}

export function montarAjustes(campos: CamposEvento): { ajustes: AjustesEvento } | { erro: Partial<Record<keyof CamposEvento, string>> } {
  const erro: Partial<Record<keyof CamposEvento, string>> = {};
  const titulo = campos.titulo.trim();
  const local = campos.local.trim();
  if (!titulo) erro.titulo = 'Preencha o nome do evento.';
  else if (titulo.length > 160) erro.titulo = 'O nome do evento passou de 160 caracteres.';
  if (local.length > 500) erro.local = 'O local passou de 500 caracteres.';
  const event_date = isoDeBrasilia(campos.data, campos.hora);
  if (!event_date) erro.data = 'Informe uma data e um horário válidos. Use o horário de Brasília.';
  const contribution_value = lerContribuicao(campos.valor);
  if (contribution_value === null) erro.valor = 'Informe um valor com no máximo 2 casas decimais.';
  if (Object.keys(erro).length || contribution_value === null || !event_date) return { erro };
  return { ajustes: { event_title: titulo, event_date, event_place: local, contribution_value } };
}
