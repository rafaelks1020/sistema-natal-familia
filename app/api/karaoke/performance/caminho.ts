/** Vídeo da apresentação inteira: até 400 MB, webm, um arquivo novo por envio. */

export const MAX_BYTES_PERFORMANCE = 400 * 1024 * 1024;
/** Abaixo disso o arquivo nem é enviado (gravação vazia ou quebrada). */
export const MIN_BYTES_PERFORMANCE = 50_000;

const SUFIXO = /^[0-9a-f]{8,32}$/;

/** karaoke/performances/<ano>/<fila_id>-<sufixo>.webm */
export function caminhoPerformance(ano: number, filaId: number, codigo: string): string {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new Error('ano inválido');
  if (!Number.isInteger(filaId) || filaId <= 0) throw new Error('fila inválida');
  if (!SUFIXO.test(codigo)) throw new Error('sufixo inválido');
  return `karaoke/performances/${ano}/${filaId}-${codigo}.webm`;
}

/** O pathname (com barra no começo) é o vídeo desta música? */
export function performanceDestaFila(caminho: string, ano: number, filaId: number): boolean {
  const prefixo = `/karaoke/performances/${ano}/${filaId}-`;
  if (!caminho.startsWith(prefixo) || !caminho.endsWith('.webm')) return false;
  return SUFIXO.test(caminho.slice(prefixo.length, -'.webm'.length));
}
