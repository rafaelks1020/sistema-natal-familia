export const tiposCarona = ['carona_oferta', 'carona_pedido', 'hospedagem_oferta', 'hospedagem_pedido'] as const;
export type TipoCarona = typeof tiposCarona[number];
export const rotulosCarona: Record<TipoCarona, string> = {
  carona_oferta: 'Ofereço carona', carona_pedido: 'Preciso de carona',
  hospedagem_oferta: 'Ofereço hospedagem', hospedagem_pedido: 'Preciso de hospedagem',
};
export interface Reserva { user_id: number; name: string; quantidade: number }
export interface Oferta {
  id: number; ano: number; user_id: number; name: string; avatar_url: string | null;
  tipo: TipoCarona; origem: string; quando: string; vagas: number; observacao: string;
  telefone: string | null; ativo: boolean; minha_reserva: number; reservas: Reserva[];
}
export interface CaronasData { ano: number; ofertas: Oferta[] }
