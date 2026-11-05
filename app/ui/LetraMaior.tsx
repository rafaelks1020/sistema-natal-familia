'use client';

import { useEffect, useState } from 'react';
import { Type } from 'lucide-react';

// Liga e desliga a letra maior (fica guardado no aparelho).
export default function LetraMaior() {
  const [grande, setGrande] = useState(false);

  useEffect(() => {
    // Sincroniza com a classe que o script do layout já aplicou antes de pintar.
    const t = setTimeout(() => setGrande(document.documentElement.classList.contains('letra-grande')), 0);
    return () => clearTimeout(t);
  }, []);

  function alternar() {
    const novo = !grande;
    setGrande(novo);
    document.documentElement.classList.toggle('letra-grande', novo);
    try {
      if (novo) localStorage.setItem('nf_letra', 'grande');
      else localStorage.removeItem('nf_letra');
    } catch {
      /* navegador sem armazenamento: vale só nesta visita */
    }
  }

  return (
    <button type="button" onClick={alternar} aria-pressed={grande} className="btn btn-quiet text-xs">
      <Type size={15} strokeWidth={1.5} />
      {grande ? 'Letra normal' : 'Letra maior'}
    </button>
  );
}
