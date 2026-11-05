export interface Participant { id: number; name: string }
export interface DrawRule {
  type: 'cannot_draw';
  participant1_id: number;
  participant2_id: number;
}
export interface DrawResult { giver_id: number; receiver_id: number }

/** Mantém um único ciclo e todas as restrições. O histórico é direcional. */
export function drawSecretSanta(
  participants: Participant[], rules: DrawRule[] = [], previous: DrawResult[] = [],
): DrawResult[] | null {
  const n = participants.length;
  if (n < 3) throw new Error('É necessário pelo menos 3 participantes para o sorteio');
  if (new Set(participants.map(p => p.id)).size !== n) throw new Error('Há participantes repetidos.');
  const blocked = new Set(previous.map(p => `${p.giver_id}:${p.receiver_id}`));
  for (const r of rules) {
    blocked.add(`${r.participant1_id}:${r.participant2_id}`);
    blocked.add(`${r.participant2_id}:${r.participant1_id}`);
  }
  const can = (a: number, b: number) => a !== b && !blocked.has(`${participants[a].id}:${participants[b].id}`);
  const options = participants.map((_, a) => participants.map((_, b) => b).filter(b => can(a, b)));
  if (options.some(list => !list.length)) return null;
  const path = [0], used = new Set([0]);
  // Busca limitada para proteger a API de conjuntos patológicos. Nunca relaxa regras sozinha.
  let remaining = 500_000;
  function search(): boolean {
    if (--remaining < 0) return false;
    const last = path[path.length - 1];
    if (path.length === n) return can(last, 0);
    const candidates = options[last].filter(i => !used.has(i));
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const next of candidates) {
      if (path.length === n - 1 && !can(next, 0)) continue;
      used.add(next); path.push(next);
      if (search()) return true;
      path.pop(); used.delete(next);
      if (remaining < 0) break;
    }
    return false;
  }
  if (!search()) return null;
  return path.map((giver, i) => ({ giver_id: participants[giver].id, receiver_id: participants[path[(i + 1) % n]].id }));
}

export function validateRules(participants: Participant[], rules: DrawRule[], previous: DrawResult[] = []): { valid: boolean; error?: string } {
  try {
    return drawSecretSanta(participants, rules, previous)
      ? { valid: true }
      : { valid: false, error: 'Não foi possível sortear com essas regras.' };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Regras inválidas.' };
  }
}
