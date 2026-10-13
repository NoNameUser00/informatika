// Диаграммы аналитики (recharts). Отдельный чанк: грузится лениво,
// в главный бандл не входит.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function MarkBars({ data }: { data: { mark: string; n: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} role="img" aria-label="Распределение отметок">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="mark" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="n" name="Учеников" fill="#1e3a8a" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopicBars({ data }: { data: { topic: string; pct: number; fill: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36 + 40)}>
      <BarChart data={data} layout="vertical" role="img" aria-label="Освоение тем в процентах">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} />
        <YAxis type="category" dataKey="topic" width={150} />
        <Tooltip />
        <Bar dataKey="pct" name="% верных">
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Charts(props: { kind: 'marks'; data: { mark: string; n: number }[] } | { kind: 'topics'; data: { topic: string; pct: number; fill: string }[] }) {
  if (props.kind === 'marks') return <MarkBars data={props.data} />;
  return <TopicBars data={props.data} />;
}
