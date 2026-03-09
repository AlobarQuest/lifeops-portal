type MetricCardProps = {
  label: string;
  value: string;
  tone: string;
};

export function MetricCard({ label, value, tone }: MetricCardProps) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

