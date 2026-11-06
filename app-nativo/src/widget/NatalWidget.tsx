import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { Contagem } from './dados';

const FUNDO = '#171B18';
const MARFIM = '#F3EBDC';
const CEREJA = '#C5292D';
const APAGADO = '#B9B2A2';

function rotuloDias(dias: number) {
  return dias === 1 ? 'dia' : 'dias';
}

export function NatalWidget({ contagem, grande }: { contagem: Contagem; grande: boolean }) {
  const { dias, horas, titulo, semData } = contagem;
  const fundo = { backgroundColor: FUNDO, borderRadius: 24, width: 'match_parent', height: 'match_parent', padding: 14 } as const;
  if (semData) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ ...fundo, justifyContent: 'center', alignItems: 'center' }}>
        <TextWidget text="Natal em Família" style={{ fontSize: 18, fontWeight: 'bold', color: MARFIM }} />
      </FlexWidget>
    );
  }
  if (!grande) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ ...fundo, justifyContent: 'center', alignItems: 'center' }}>
        <TextWidget text="NATAL EM FAMÍLIA" style={{ fontSize: 9, color: CEREJA, fontWeight: 'bold', letterSpacing: 1.5 }} />
        <TextWidget text={String(dias)} style={{ fontSize: 52, fontWeight: 'bold', color: MARFIM }} />
        <TextWidget text={dias === 0 ? 'é hoje' : `${rotuloDias(dias)} para a ceia`} style={{ fontSize: 12, color: APAGADO }} />
      </FlexWidget>
    );
  }
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...fundo, flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget style={{ flex: 1, height: 'match_parent', justifyContent: 'center' }}>
        <TextWidget text="NATAL EM FAMÍLIA" style={{ fontSize: 10, color: CEREJA, fontWeight: 'bold', letterSpacing: 1.5 }} />
        <TextWidget text={titulo} maxLines={2} truncate="END" style={{ fontSize: 20, fontWeight: 'bold', color: MARFIM }} />
        <TextWidget text="contagem para a ceia" style={{ fontSize: 12, color: APAGADO }} />
      </FlexWidget>
      <FlexWidget style={{ alignItems: 'center', marginLeft: 8 }}>
        <TextWidget text={String(dias)} style={{ fontSize: 44, fontWeight: 'bold', color: MARFIM }} />
        <TextWidget text={rotuloDias(dias)} style={{ fontSize: 12, color: APAGADO }} />
      </FlexWidget>
      <FlexWidget style={{ alignItems: 'center', marginLeft: 16 }}>
        <TextWidget text={String(horas)} style={{ fontSize: 44, fontWeight: 'bold', color: CEREJA }} />
        <TextWidget text={horas === 1 ? 'hora' : 'horas'} style={{ fontSize: 12, color: APAGADO }} />
      </FlexWidget>
    </FlexWidget>
  );
}
