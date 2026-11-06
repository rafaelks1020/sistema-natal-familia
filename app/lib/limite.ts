// Limite simples por usuário em memória (janela deslizante). Vale por instância do servidor.
const registros = new Map<string, Map<number, number[]>>();

/** true se ainda cabe uma chamada (e já a registra); false se passou do limite na janela. */
export function dentroDoLimite(grupo: string, userId: number, max: number, janelaMs = 60_000): boolean {
  const agora = Date.now();
  let porUsuario = registros.get(grupo);
  if (!porUsuario) { porUsuario = new Map(); registros.set(grupo, porUsuario); }
  const recentes = (porUsuario.get(userId) ?? []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= max) { porUsuario.set(userId, recentes); return false; }
  recentes.push(agora);
  porUsuario.set(userId, recentes);
  if (porUsuario.size > 500) {
    for (const [id, ts] of porUsuario) if (!ts.some((t) => agora - t < janelaMs)) porUsuario.delete(id);
  }
  return true;
}
