import { Linking } from 'react-native';
import { api, API_BASE_URL } from './api';

/**
 * Abre uma tela do site no navegador do celular já com a pessoa logada.
 * O app pede ao servidor um código que vale 45 segundos e o navegador troca esse código pelo login do site.
 * O token da sessão nunca vai na URL. Se a passagem falhar, a tela abre do mesmo jeito e o site pede o login.
 */
export async function abrirNoSite(caminho: string): Promise<void> {
  const destino = caminho.startsWith('/') ? caminho : `/${caminho}`;
  let url = `${API_BASE_URL}${destino}`;
  try {
    const { codigo } = await api<{ codigo: string }>('/api/auth/passagem', { method: 'POST', timeoutMs: 6000 });
    url = `${API_BASE_URL}/api/auth/passagem?c=${encodeURIComponent(codigo)}&para=${encodeURIComponent(destino)}`;
  } catch {
    // sem a passagem (rede ruim, servidor antigo): segue para a tela, e o site pede usuário e senha
  }
  await Linking.openURL(url);
}
