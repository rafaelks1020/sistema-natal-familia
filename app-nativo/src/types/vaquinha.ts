export interface Participant {
  id: number;
  name: string;
  paid: boolean;
  paid_date: string | null;
  user_id: number | null;
  avatar_url: string | null;
  pix: boolean;
}

export const purchaseCategories = ['Ceia', 'Bebidas', 'Decoração', 'Presentes', 'Outros'] as const;
export type PurchaseCategory = typeof purchaseCategories[number];
export interface Purchase {
  id: number;
  description: string;
  value: number;
  category: string;
  brand: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  notes: string | null;
  images: string[];
  created_at: string;
}
export interface TimelineEvent {
  id: string;
  ref_id: number;
  type: 'payment' | 'purchase';
  description: string;
  value: number;
  date: string;
  name: string | null;
  avatar_url: string | null;
  category: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  quantity: number | null;
  notes: string | null;
  images: string[];
}
export interface VaquinhaData {
  contribution_value: number;
  arrecadado: number;
  gasto: number;
  saldo: number;
  participants: Participant[];
  purchases: Purchase[];
  timeline: TimelineEvent[];
}
export interface PurchaseInput {
  description: string;
  value: number;
  category: PurchaseCategory;
  brand: string;
  color: string;
  size: string;
  quantity: number;
  notes: string;
}
export interface BillingAddress {
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
}
export interface Payment {
  reference: string;
  amount: number;
  status: string;
  paid: boolean;
  pix_copia_cola: string | null;
  linha_digitavel: string | null;
  due_date: string | null;
  created_at: string;
  paid_at: string | null;
}
export interface PaymentStatus {
  enabled: boolean;
  amount: number;
  participant_paid: boolean;
  paid_date: string | null;
  payment: Payment | null;
  billing: { cpf_masked: string | null; has_cpf: boolean; address: BillingAddress | null };
}
export interface PaymentInput extends BillingAddress { valor: number; cpf: string }
export interface PaymentResult { payment: Payment | null; reused: boolean }
