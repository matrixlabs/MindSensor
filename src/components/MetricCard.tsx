interface MetricCardProps {
  title: string;
  value: number;
  valueColor?: string;
}

export default function MetricCard({ title, value, valueColor = 'text-slate-900' }: MetricCardProps) {
  return (
    <div className="w-[151px] h-[162px] border border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center bg-white">
      <div className="text-lg font-semibold text-slate-400 mb-4">{title}</div>
      <div className={`text-2xl font-semibold ${valueColor} leading-none`}>{value}</div>
    </div>
  );
}

