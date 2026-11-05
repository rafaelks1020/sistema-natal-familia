'use client';

import { useRef, useState } from 'react';
import {
  Camera,
  Check,
  Receipt,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import { api, brl, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type {
   PurchaseCategory,
  VaquinhaParticipant,
  VaquinhaPurchase,
} from '@/app/api/vaquinha/_helpers';

const CATEGORIES: PurchaseCategory[] = [
  'Ceia',
  'Bebidas',
  'Decoração',
  'Presentes',
  'Outros',
];

function formatFullDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

interface PurchaseDetailSheetProps {
  purchase: VaquinhaPurchase | null;
  isAdmin: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function PurchaseDetailSheet({
  purchase,
  isAdmin,
  onClose,
  onDeleted,
}: PurchaseDetailSheetProps) {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  if (!purchase) return null;

  const images = purchase.images ?? [];

  async function handleDelete() {
    if (!purchase) return;
    setDeleting(true);
    try {
      await api(`/api/vaquinha/purchases/${purchase.id}`, { method: 'DELETE' });
      toast('Gasto removido');
      setConfirmDelete(false);
      onDeleted();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-xs fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={purchase.description}
        className="rise max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border-t border-linha-forte bg-carvao-2 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-linha-forte" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="kicker mb-1">{purchase.category}</p>
            <h2 className="display text-2xl text-marfim">{purchase.description}</h2>
            <p className="mt-1 text-xs text-marfim-3">{formatFullDate(purchase.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhe"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-linha text-marfim-2"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="my-4 flex items-baseline justify-between border-y border-linha py-3">
          <span className="text-xs uppercase tracking-widest text-marfim-3">Valor total</span>
          <span className="numeral text-3xl text-champagne">{brl(purchase.value)}</span>
        </div>

        {images.length > 0 && (
          <div className="mb-5 space-y-2.5">
            <div className="overflow-hidden rounded-[16px] bg-carvao-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[activeImg] || images[0]}
                alt={purchase.description}
                className="max-h-80 w-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {images.map((url, idx) => (
                  <button
                    key={url + idx}
                    type="button"
                    onClick={() => setActiveImg(idx)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] border transition ${
                      activeImg === idx ? 'border-champagne ring-1 ring-champagne' : 'border-linha opacity-65'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[14px] border border-linha bg-carvao/60 px-3.5 py-2.5">
            <span className="block text-[11px] uppercase tracking-wider text-marfim-3">Quantidade</span>
            <span className="mt-0.5 block font-medium text-marfim">{purchase.quantity || 1}</span>
          </div>
          <div className="rounded-[14px] border border-linha bg-carvao/60 px-3.5 py-2.5">
            <span className="block text-[11px] uppercase tracking-wider text-marfim-3">Marca</span>
            <span className="mt-0.5 block font-medium text-marfim">{purchase.brand || 'Não informada'}</span>
          </div>
          <div className="rounded-[14px] border border-linha bg-carvao/60 px-3.5 py-2.5">
            <span className="block text-[11px] uppercase tracking-wider text-marfim-3">Cor</span>
            <span className="mt-0.5 block font-medium text-marfim">{purchase.color || 'Não informada'}</span>
          </div>
          <div className="rounded-[14px] border border-linha bg-carvao/60 px-3.5 py-2.5">
            <span className="block text-[11px] uppercase tracking-wider text-marfim-3">Tamanho</span>
            <span className="mt-0.5 block font-medium text-marfim">{purchase.size || 'Não informado'}</span>
          </div>
        </div>

        {purchase.notes && (
          <div className="mt-3 rounded-[14px] border border-linha bg-carvao/60 p-3.5">
            <span className="block text-[11px] uppercase tracking-wider text-champagne">Observações</span>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-marfim-2">
              {purchase.notes}
            </p>
          </div>
        )}

        {isAdmin && (
          <div className="mt-6 border-t border-linha pt-4">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="btn btn-ghost w-full border-cereja/40 text-[#ff8a8d]"
              >
                <Trash2 size={17} strokeWidth={1.5} />
                Apagar gasto
              </button>
            ) : (
              <div className="space-y-2.5 rounded-[14px] border border-cereja/50 bg-carvao p-3.5">
                <p className="text-center text-sm text-marfim">
                  Tem certeza que deseja apagar <strong>{purchase.description}</strong>?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="btn btn-ghost flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="btn btn-primary flex-1"
                  >
                    {deleting ? 'Apagando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ParticipantActionSheetProps {
  participant: VaquinhaParticipant | null;
  contributionValue: number;
  onClose: () => void;
  onUpdated: () => void;
}

export function ParticipantActionSheet({
  participant,
  contributionValue,
  onClose,
  onUpdated,
}: ParticipantActionSheetProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!participant) return null;

  const nextPaid = !participant.paid;

  async function handleTogglePaid() {
    if (!participant) return;
    setBusy(true);
    try {
      await api(`/api/vaquinha/participants/${participant.id}`, {
        method: 'PUT',
        json: { paid: nextPaid },
      });
      toast(nextPaid ? `${participant.name} marcado como pago` : `${participant.name} voltou para pendente`);
      onUpdated();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!participant) return;
    setBusy(true);
    try {
      await api(`/api/vaquinha/participants/${participant.id}`, {
        method: 'DELETE',
      });
      toast('Participante removido');
      setConfirmRemove(false);
      onUpdated();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-xs fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={participant.name}
        className="rise w-full max-w-lg rounded-t-[24px] border-t border-linha-forte bg-carvao-2 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-linha-forte" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={participant.name} src={participant.avatar_url} size={46} ring={participant.paid} />
            <div className="min-w-0">
              <p className="kicker">Cota {brl(contributionValue)}</p>
              <h2 className="display truncate text-2xl text-marfim">{participant.name}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-linha text-marfim-2"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-5 rounded-[16px] border border-linha bg-carvao p-4">
          <p className="text-sm text-marfim-2">
            {nextPaid
              ? `Confirmar que ${participant.name} pagou a cota de ${brl(contributionValue)}?`
              : `Marcar a contribuição de ${participant.name} como pendente?`}
          </p>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="btn btn-ghost flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleTogglePaid}
              disabled={busy}
              className="btn btn-primary flex-1"
            >
              <Check size={17} strokeWidth={1.5} />
              {busy ? 'Salvando...' : nextPaid ? 'Confirmar pago' : 'Voltar pendente'}
            </button>
          </div>
        </div>

        {participant.user_id === null ? (
          <div className="mt-4 border-t border-linha pt-4">
            {!confirmRemove ? (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={busy}
                className="btn btn-quiet w-full text-xs text-[#ff8a8d]"
              >
                <Trash2 size={15} strokeWidth={1.5} />
                Remover participante da lista
              </button>
            ) : (
              <div className="space-y-2.5 rounded-[14px] border border-cereja/50 bg-carvao p-3.5">
                <p className="text-center text-xs text-marfim-2">
                  Remover <strong>{participant.name}</strong> da vaquinha?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    disabled={busy}
                    className="btn btn-ghost flex-1"
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={busy}
                    className="btn btn-primary flex-1"
                  >
                    {busy ? 'Removendo...' : 'Sim, remover'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-marfim-3">
            Parente com acesso ativo no aplicativo.
          </p>
        )}
      </div>
    </div>
  );
}

interface AdminCreateSheetProps {
  open: boolean;
  initialMode?: 'purchase' | 'participant';
  onClose: () => void;
  onSaved: () => void;
}

export function AdminCreateSheet({
  open,
  initialMode = 'purchase',
  onClose,
  onSaved,
}: AdminCreateSheetProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'purchase' | 'participant'>(initialMode);

  // Estado de novo participante
  const [participantName, setParticipantName] = useState('');

  // Estado de novo gasto
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<PurchaseCategory>('Ceia');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;

    const remaining = 6 - images.length;
    if (remaining <= 0) {
      toast('Máximo de 6 fotos atingido', 'erro');
      return;
    }

    const slice = files.slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of slice) {
        const url = await uploadImage(file);
        uploaded.push(url);
      }
      setImages((prev) => [...prev, ...uploaded].slice(0, 6));
      toast(uploaded.length > 1 ? 'Fotos anexadas' : 'Foto anexada');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitParticipant(e: React.FormEvent) {
    e.preventDefault();
    if (!participantName.trim()) {
      toast('Digite o nome do parente', 'erro');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/vaquinha/participants', {
        method: 'POST',
        json: { name: participantName.trim() },
      });
      toast('Participante incluído na vaquinha');
      setParticipantName('');
      onSaved();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast('Preencha a descrição do gasto', 'erro');
      return;
    }
    if (!value.trim()) {
      toast('Informe o valor do gasto', 'erro');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/vaquinha/purchases', {
        method: 'POST',
        json: {
          description: description.trim(),
          value: value.trim(),
          category,
          brand: brand.trim() || undefined,
          color: color.trim() || undefined,
          size: size.trim() || undefined,
          quantity: quantity ? Number(quantity) : 1,
          notes: notes.trim() || undefined,
          images,
        },
      });
      toast('Gasto registrado no livro da ceia');
      setDescription('');
      setValue('');
      setCategory('Ceia');
      setBrand('');
      setColor('');
      setSize('');
      setQuantity('1');
      setNotes('');
      setImages([]);
      onSaved();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-xs fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar à vaquinha"
        className="rise max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border-t border-linha-forte bg-carvao-2 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-linha-forte" />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="kicker">Organização</p>
            <h2 className="display text-2xl text-marfim">
              {mode === 'purchase' ? 'Novo gasto da ceia' : 'Novo participante'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-linha text-marfim-2"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Alternador entre Novo Gasto e Novo Participante */}
        <div className="mt-4 grid grid-cols-2 border-b border-linha">
          <button
            type="button"
            onClick={() => setMode('purchase')}
            className={`flex items-center justify-center gap-2 border-b-2 py-3 text-sm font-medium transition ${
              mode === 'purchase'
                ? 'border-cereja text-marfim'
                : 'border-transparent text-marfim-3'
            }`}
          >
            <Receipt size={16} strokeWidth={1.5} />
            Novo gasto
          </button>
          <button
            type="button"
            onClick={() => setMode('participant')}
            className={`flex items-center justify-center gap-2 border-b-2 py-3 text-sm font-medium transition ${
              mode === 'participant'
                ? 'border-cereja text-marfim'
                : 'border-transparent text-marfim-3'
            }`}
          >
            <UserPlus size={16} strokeWidth={1.5} />
            Novo participante
          </button>
        </div>

        {mode === 'participant' ? (
          <form onSubmit={submitParticipant} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-marfim-2">
                Nome do parente
              </label>
              <input
                type="text"
                className="field"
                placeholder="Ex.: Tia Helena"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                maxLength={60}
                required
              />
              <p className="mt-2 text-xs text-marfim-3">
                Quando a pessoa criar o acesso dela com o mesmo nome, o vínculo será automático.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full"
            >
              {submitting ? 'Adicionando...' : 'Incluir participante'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitPurchase} className="mt-5 space-y-3.5">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-marfim-2">
                Descrição do gasto
              </label>
              <input
                type="text"
                className="field"
                placeholder="Ex.: Peru temperado e castanhas"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={160}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-marfim-2">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="field numeral"
                  placeholder="120,50"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-marfim-2">
                  Categoria
                </label>
                <select
                  className="field"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PurchaseCategory)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-marfim-3">
                  Marca (opcional)
                </label>
                <input
                  type="text"
                  className="field"
                  placeholder="Ex.: Sadia"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-marfim-3">
                  Quantidade
                </label>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  className="field"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-marfim-3">
                  Cor (opcional)
                </label>
                <input
                  type="text"
                  className="field"
                  placeholder="Ex.: Dourado"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  maxLength={60}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-marfim-3">
                  Tamanho (opcional)
                </label>
                <input
                  type="text"
                  className="field"
                  placeholder="Ex.: 4 kg"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  maxLength={60}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-marfim-3">
                Observações (opcional)
              </label>
              <textarea
                rows={2}
                className="field resize-none"
                placeholder="Detalhes da compra, mercado ou comprovante"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={600}
              />
            </div>

            {/* Fotos (até 6) */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-marfim-2">
                  Fotos ({images.length}/6)
                </span>
                {images.length < 6 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-champagne"
                  >
                    <Camera size={15} strokeWidth={1.5} />
                    {uploading ? 'Enviando...' : 'Adicionar foto'}
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />

              {images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {images.map((url, idx) => (
                    <div
                      key={url + idx}
                      className="relative aspect-square overflow-hidden rounded-[14px] border border-linha bg-carvao-3"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Anexo ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        aria-label="Remover foto"
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-carvao/85 text-marfim"
                      >
                        <X size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-linha-forte bg-carvao/50 py-4 text-sm text-marfim-2 transition hover:border-champagne/60"
                >
                  <Camera size={18} strokeWidth={1.5} className="text-champagne" />
                  {uploading ? 'Enviando foto...' : 'Anexar até 6 fotos ou comprovantes'}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="btn btn-primary mt-2 w-full"
            >
              {submitting ? 'Salvando gasto...' : 'Registrar gasto'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
