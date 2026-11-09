import Link from 'next/link';
import PageHeader from '@/app/ui/PageHeader';
export default function RegulamentoProva() {
  return <><PageHeader kicker="Brinde Voz do Natal" title="Regulamento da Prova" back="/karaoke?aba=prova" />
    <article className="space-y-5 px-5 pb-10 text-marfim-2">
      <section className="surface space-y-3 p-5"><h2 className="display text-2xl text-marfim">Uma chance para cada música</h2>
        <p>A organização confirma cinco músicas do catálogo e anuncia as datas. Na eliminatória, você canta essas músicas no telão em casa ou com a família, sempre em modo Prova.</p>
        <p>Antes de começar, confira o microfone e a letra. A tentativa oficial só nasce quando o instrumental começa a tocar, depois da tela de regras. Ligar o microfone e preparar a apresentação não gastam sua chance.</p>
        <p>Cada pessoa tem uma tentativa por música em cada fase. O nível Difícil fica travado. Não pode pular trecho, pausar ou recomeçar. O modo livre continua disponível para treinar.</p>
        <p>Se parar, fechar a tela, perder o som ou ficar sem conexão com o telão, a tentativa será abandonada. O parcial salvo vale como nota, calculado sobre a música inteira. O que não cantou vale zero. Não há segunda chance. Tentativas sem contato há 45 segundos são encerradas na próxima consulta à Prova; em uma queda abrupta, vale o último parcial recebido.</p>
      </section>
      <section className="surface space-y-3 p-5"><h2 className="display text-2xl text-marfim">Como a nota é calculada</h2>
        <p>A nota vai de 0 a 100. O sistema compara sua voz com as notas da melodia. Você precisa cantar no tom e no tempo de cada nota. Uma nota longa pesa mais; as notas douradas têm peso dobrado.</p>
        <p>No Difícil, até 0,25 semitom de diferença dá acerto cheio. A partir de 0,8 semitom não pontua. A régua espera voz em 75% do tempo de cada nota, com tolerância de 40 milissegundos nas bordas. Atraso do microfone: 140 milissegundos, igual para todos. A oitava é ignorada, então vozes graves e agudas podem disputar juntas.</p>
        <p>As notas rendem até 9.000 pontos. As linhas da letra rendem até 1.000, conforme o acerto. Sequências de 5, 10 e 20 notas ativam combos x2, x3 e x4 e dão até 1.500 pontos extras. Uma nota precisa de pelo menos 60% de acerto para manter o combo; notas abaixo de 150 milissegundos não mudam a sequência. Gestos e Modo Estrela não dão bônus na Prova.</p>
        <p>A soma tem limite de 10.000 pontos. Dividimos por 100 e arredondamos para a nota final. A tela final mostra a afinação, a presença da voz no tempo das notas, as notas acertadas, as perfeitas e os bônus. Ficar em silêncio ou manter um único tom enquanto a melodia muda reduz a nota.</p>
      </section>
      <section className="surface space-y-3 p-5"><h2 className="display text-2xl text-marfim">Eliminatória e final</h2>
        <p>Somamos as cinco notas, até 500 pontos. Música que você não cantou vale zero. As quatro maiores somas vão à final. Para desempatar a eliminatória, vale a afinação média das cinco músicas, com zero nas faltantes. Persistindo o empate, vale a ordem de cadastro.</p>
        <p>A classificação aparece no aplicativo até a data de ocultação do ranking geral. O padrão é 22 de dezembro, às 22h de São Paulo, dois dias antes do encerramento. Depois, o resultado fica em suspense para a festa. Suas próprias tentativas continuam visíveis.</p>
        <p>Na final ao vivo, o telão sorteia uma das cinco músicas. O sorteio fica gravado e não pode ser repetido. Os finalistas cantam essa mesma música uma vez, na sequência da classificação da eliminatória.</p>
        <p>Vence a maior nota da final. Em empate, vale a soma da eliminatória e depois a afinação média das cinco músicas da eliminatória. Se tudo empatar, vale a ordem de cadastro. Uma tentativa abandonada também pode valer na classificação, com o parcial registrado.</p>
      </section>
      <section className="surface space-y-3 p-5"><h2 className="display text-2xl text-marfim">Dois brindes, duas disputas</h2>
        <p>A Voz do Natal é quem vence a Prova. O Campeão do Natal vem dos pontos de uso do aplicativo, brincadeiras e conquistas. As apresentações oficiais também contam para esses pontos pelas regras normais do karaokê. A mesma pessoa pode ganhar os dois brindes.</p>
        <p>A sugestão das músicas usa dados do catálogo: extensão das notas (40%), duração das notas longas (30%) e velocidade estimada das sílabas da letra (30%). A organização confirma as cinco escolhidas antes de abrir a disputa.</p>
      </section>
      <Link href="/telao/karaoke?modo=prova" className="btn btn-primary w-full">Abrir telão da Prova</Link>
    </article>
  </>;
}
