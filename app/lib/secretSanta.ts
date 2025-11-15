// 🎁 Algoritmo de Sorteio de Amigo Oculto (Amigo Secreto)

export interface Participant {
  id: number;
  name: string;
}

export interface DrawRule {
  type: 'cannot_draw'; // Tipo de regra
  participant1_id: number; // Pessoa 1
  participant2_id: number; // Pessoa 2 (não pode tirar pessoa 1 e vice-versa)
}

export interface DrawResult {
  giver_id: number;
  receiver_id: number;
}

/**
 * Algoritmo de sorteio de amigo oculto com validações
 * 
 * Regras:
 * 1. Ninguém pode tirar a si mesmo
 * 2. Cada pessoa tira exatamente uma pessoa
 * 3. Cada pessoa é tirada por exatamente uma pessoa
 * 4. Respeita regras customizadas (ex: casais não podem tirar um ao outro)
 * 
 * Algoritmo: Permutação aleatória com validação de ciclo hamiltoniano
 */
export function drawSecretSanta(
  participants: Participant[],
  rules: DrawRule[] = []
): DrawResult[] | null {
  
  const n = participants.length;
  
  // Validações básicas
  if (n < 3) {
    throw new Error('É necessário pelo menos 3 participantes para o sorteio');
  }
  
  // Criar matriz de restrições
  const canDraw: boolean[][] = Array(n).fill(null).map(() => Array(n).fill(true));
  
  // Aplicar regra: ninguém pode tirar a si mesmo
  for (let i = 0; i < n; i++) {
    canDraw[i][i] = false;
  }
  
  // Aplicar regras customizadas
  for (const rule of rules) {
    const idx1 = participants.findIndex(p => p.id === rule.participant1_id);
    const idx2 = participants.findIndex(p => p.id === rule.participant2_id);
    
    if (idx1 !== -1 && idx2 !== -1) {
      canDraw[idx1][idx2] = false;
      canDraw[idx2][idx1] = false;
    }
  }
  
  // Verificar se é possível fazer o sorteio
  for (let i = 0; i < n; i++) {
    const possibleReceivers = canDraw[i].filter(can => can).length;
    if (possibleReceivers === 0) {
      throw new Error(`Impossível sortear: participante ${participants[i].name} não tem ninguém para tirar`);
    }
  }
  
  // Tentar fazer o sorteio (máximo 1000 tentativas)
  const maxAttempts = 1000;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = tryDraw(participants, canDraw);
    if (result) {
      return result;
    }
  }
  
  // Se não conseguiu após 1000 tentativas, as regras são muito restritivas
  throw new Error('Não foi possível realizar o sorteio com as regras definidas. Tente remover algumas restrições.');
}

/**
 * Tenta fazer um sorteio válido
 */
function tryDraw(
  participants: Participant[],
  canDraw: boolean[][]
): DrawResult[] | null {
  
  const n = participants.length;
  const receivers = [...Array(n).keys()]; // [0, 1, 2, ..., n-1]
  
  // Embaralhar receivers (Fisher-Yates shuffle)
  for (let i = receivers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
  }
  
  // Verificar se o sorteio é válido
  for (let giver = 0; giver < n; giver++) {
    const receiver = receivers[giver];
    
    // Se não pode tirar essa pessoa, sorteio inválido
    if (!canDraw[giver][receiver]) {
      return null;
    }
  }
  
  // Verificar se forma um ciclo (todos estão conectados)
  if (!isValidCycle(receivers)) {
    return null;
  }
  
  // Sorteio válido! Converter para resultado
  return receivers.map((receiver, giver) => ({
    giver_id: participants[giver].id,
    receiver_id: participants[receiver].id
  }));
}

/**
 * Verifica se a permutação forma um ciclo válido
 * (todos os participantes estão conectados em um único ciclo)
 */
function isValidCycle(permutation: number[]): boolean {
  const n = permutation.length;
  const visited = new Set<number>();
  
  let current = 0;
  for (let i = 0; i < n; i++) {
    if (visited.has(current)) {
      // Voltou antes de visitar todos = ciclo incompleto
      return i === n;
    }
    visited.add(current);
    current = permutation[current];
  }
  
  // Deve ter visitado todos e voltado ao início
  return visited.size === n && current === 0;
}

/**
 * Valida se um conjunto de regras é viável
 */
export function validateRules(
  participants: Participant[],
  rules: DrawRule[]
): { valid: boolean; error?: string } {
  
  try {
    // Criar matriz de restrições
    const n = participants.length;
    const canDraw: boolean[][] = Array(n).fill(null).map(() => Array(n).fill(true));
    
    // Aplicar regra: ninguém pode tirar a si mesmo
    for (let i = 0; i < n; i++) {
      canDraw[i][i] = false;
    }
    
    // Aplicar regras customizadas
    for (const rule of rules) {
      const idx1 = participants.findIndex(p => p.id === rule.participant1_id);
      const idx2 = participants.findIndex(p => p.id === rule.participant2_id);
      
      if (idx1 !== -1 && idx2 !== -1) {
        canDraw[idx1][idx2] = false;
        canDraw[idx2][idx1] = false;
      }
    }
    
    // Verificar se cada pessoa tem pelo menos uma opção
    for (let i = 0; i < n; i++) {
      const possibleReceivers = canDraw[i].filter(can => can).length;
      if (possibleReceivers === 0) {
        return {
          valid: false,
          error: `${participants[i].name} não tem ninguém para tirar com essas regras`
        };
      }
    }
    
    return { valid: true };
    
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
