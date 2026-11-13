import type { CategoriaPrato, CeiaPrato, CeiaTotais, TipoVotacao } from './tipos';
import { CATEGORIAS, TIPOS_VOTACAO } from './tipos';

export function rotuloCategoria(id: CategoriaPrato): string {
  return CATEGORIAS.find((item) => item.id === id)?.rotulo ?? 'Outros';
}

export function rotuloTipo(id: TipoVotacao): string {
  return TIPOS_VOTACAO.find((item) => item.id === id)?.rotulo ?? 'Outro';
}

export function chavePrato(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function avisoPratos(lista: { nome: string; categoria: string }[], nome: string, categoria: string): string | null {
  const chave = chavePrato(nome);
  if (chave.length < 2) return null;
  const iguais = lista.filter((item) => {
    if (item.categoria !== categoria) return false;
    const outra = chavePrato(item.nome);
    if (!outra) return false;
    if (outra === chave) return true;
    return chave.length >= 3 && outra.length >= 3 && (outra.includes(chave) || chave.includes(outra));
  });
  if (!iguais.length) return null;
  const n = iguais.length;
  const exemplo = iguais[0]?.nome ?? nome.trim();
  if (iguais.every((item) => chavePrato(item.nome) === chave)) return `Já tem ${n} ${exemplo} nesta categoria.`;
  return n === 1 ? `Já tem 1 parecido nesta categoria: ${exemplo}.` : `Já tem ${n} parecidos nesta categoria, como ${exemplo}.`;
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

export function formatarQuando(iso: string): { data: string; hora: string } {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return { data: 'Data a combinar', hora: '' };
  return {
    data: instante.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }),
    hora: instante.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
  };
}

export function formatarCurto(iso: string): string | null {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;
  const data = instante.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const hora = instante.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  return `${data}, ${hora}`;
}

export function textoOpcao(tipo: TipoVotacao, texto: string): string {
  if (tipo !== 'data') return texto;
  return formatarCurto(texto) ?? texto;
}

export function camposDeIso(iso: string): { data: string; hora: string } {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return { data: '', hora: '' };
  const fuso = partesNoFuso(instante);
  if (!fuso.ano) return { data: '', hora: '' };
  return { data: `${fuso.dia}/${fuso.mes}/${fuso.ano}`, hora: `${fuso.hora}:${fuso.minuto}` };
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

export function isoDeBrasilia(data: string, hora: string): string | null {
  const dia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.trim());
  const horario = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora.trim());
  if (!dia || !horario) return null;
  const isoLocal = `${dia[3]}-${dia[2]}-${dia[1]}T${horario[1]}:${horario[2]}:00-03:00`;
  const instante = new Date(isoLocal);
  if (Number.isNaN(instante.getTime())) return null;
  const deVolta = camposDeIso(instante.toISOString());
  if (deVolta.data !== data.trim() || deVolta.hora !== hora.trim()) return null;
  return instante.toISOString();
}

export function diasAte(iso: string, agora: number): number | null {
  const alvo = new Date(iso).getTime();
  if (!Number.isFinite(alvo)) return null;
  // Dias de calendário em São Paulo (UTC-3, sem horário de verão): "É hoje" só no dia da ceia.
  const dia = (ms: number) => Math.floor((ms - 3 * 3_600_000) / 86_400_000);
  return dia(alvo) - dia(agora);
}

export function textoDias(dias: number | null): string {
  if (dias === null) return 'A data da ceia será anunciada em breve.';
  if (dias > 1) return `Faltam ${dias} dias.`;
  if (dias === 1) return 'Falta 1 dia.';
  if (dias === 0) return 'É hoje.';
  return 'A ceia já passou.';
}

export function textoGrupo(adultos: number, criancas: number): string {
  const pessoas = adultos + criancas;
  const partes: string[] = [];
  if (adultos) partes.push(`${adultos} ${adultos === 1 ? 'adulto' : 'adultos'}`);
  if (criancas) partes.push(`${criancas} ${criancas === 1 ? 'criança' : 'crianças'}`);
  if (!pessoas || !partes.length) return 'Sem contagem de pessoas';
  return `${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}: ${partes.join(' e ')}`;
}

export function textoTotais(totais: CeiaTotais): string {
  if (!totais.confirmados) return 'A mesa ainda está esperando pela família.';
  const confirmacao = `${totais.confirmados} ${totais.confirmados === 1 ? 'confirmação' : 'confirmações'}`;
  const partes: string[] = [];
  if (totais.adultos) partes.push(`${totais.adultos} ${totais.adultos === 1 ? 'adulto' : 'adultos'}`);
  if (totais.criancas) partes.push(`${totais.criancas} ${totais.criancas === 1 ? 'criança' : 'crianças'}`);
  return partes.length ? `${confirmacao}. ${partes.join(' e ')}.` : `${confirmacao}.`;
}

export function percentual(votos: number, total: number): number {
  if (votos <= 0 || total <= 0) return 0;
  return Math.min(100, Math.max(8, Math.round((votos / total) * 100)));
}

export function situacaoVotos(opcoes: { votos: number }[]): 'vazia' | 'empate' | 'lider' {
  const total = opcoes.reduce((soma, opcao) => soma + opcao.votos, 0);
  if (!total) return 'vazia';
  const maximo = Math.max(...opcoes.map((opcao) => opcao.votos));
  return opcoes.filter((opcao) => opcao.votos === maximo).length === 1 ? 'lider' : 'empate';
}

export function quemLeva(prato: Pick<CeiaPrato, 'responsavel_id' | 'responsavel_nome'>, meuId: number): string {
  if (!prato.responsavel_id) return 'Ninguém levou ainda.';
  if (prato.responsavel_id === meuId) return 'Você leva.';
  return `${prato.responsavel_nome ?? 'Alguém da família'} leva.`;
}
