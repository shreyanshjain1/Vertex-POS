import Card from '@/components/ui/Card';

export default function StatsGrid({ cards }: { cards: Array<{ label: string; value: string; helper?: string }> }) {
  return (
    <div className="grid gap-5 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <div className="text-sm text-stone-500">{card.label}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{card.value}</div>
          {card.helper ? <div className="mt-2 text-sm text-stone-600">{card.helper}</div> : null}
        </Card>
      ))}
    </div>
  );
}
