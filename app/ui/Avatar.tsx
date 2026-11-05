// Foto do parente ou as iniciais em Bodoni sobre carvão, com aro champagne fino.

interface Props {
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function Avatar({ name, src, size = 40, ring = false, className = '' }: Props) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  const ringCls = ring ? 'ring-1 ring-champagne/70 ring-offset-2 ring-offset-carvao' : '';
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} style={style} className={`shrink-0 rounded-full object-cover ${ringCls} ${className}`} />;
  }
  return (
    <span
      style={style}
      aria-label={name}
      className={`display inline-flex shrink-0 items-center justify-center rounded-full bg-carvao-3 text-champagne ${ringCls} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
