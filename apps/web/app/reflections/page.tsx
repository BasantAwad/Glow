"use client";

import { useLanguage } from "../../contexts/LanguageContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { day: "Mon", mood: 3, notes: "Quiet day" },
  { day: "Tue", mood: 4, notes: "Felt productive" },
  { day: "Wed", mood: 2, notes: "Overwhelmed in evening" },
  { day: "Thu", mood: 5, notes: "Peaceful walk" },
  { day: "Fri", mood: 4, notes: "Good conversations" },
  { day: "Sat", mood: 6, notes: "Deep rest" },
  { day: "Sun", mood: 5, notes: "Preparing for the week" },
];

// Custom star dot
const StarDot = (props: any) => {
  const { cx, cy, value } = props;

  if (cx == null || cy == null) return null;

  return (
    <svg 
      x={cx - 8} 
      y={cy - 8} 
      width={16} 
      height={16} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      stroke="none"
      className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
    >
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
    </svg>
  );
};

export default function ReflectionsPage() {
  const { t } = useLanguage();

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          {t("reflections.title")}
        </h1>
        <p className="mt-3 text-muted-foreground text-center text-lg">
          {t("reflections.subtitle")}
        </p>
      </div>

      <div className="glass p-6 sm:p-10 rounded-3xl w-full h-[400px] mt-4 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <XAxis 
              dataKey="day" 
              stroke="rgba(255,255,255,0.4)" 
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} 
              axisLine={false} 
              tickLine={false} 
            />
            <YAxis hide domain={[0, 7]} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
              itemStyle={{ color: '#fff' }}
              formatter={(val: any, name: any, props: any) => [props.payload.notes, "Notice"]}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
            />
            <Line 
              type="monotone" 
              dataKey="mood" 
              stroke="rgba(255,255,255,0.2)" 
              strokeWidth={2}
              dot={<StarDot />}
              activeDot={<StarDot />}
              isAnimationActive={true}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}
