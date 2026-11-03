"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BarChartData {
  name: string;
  loyal: number;
  newItems: number;
  unique: number;
}

const defaultData: BarChartData[] = [
  { name: "Jan", loyal: 120, newItems: 180, unique: 60 },
  { name: "Feb", loyal: 190, newItems: 240, unique: 80 },
  { name: "Mar", loyal: 160, newItems: 280, unique: 110 },
  { name: "Apr", loyal: 140, newItems: 210, unique: 90 },
  { name: "May", loyal: 200, newItems: 310, unique: 130 },
  { name: "Jun", loyal: 100, newItems: 160, unique: 70 },
  { name: "Jul", loyal: 180, newItems: 290, unique: 120 },
  { name: "Aug", loyal: 220, newItems: 340, unique: 140 },
  { name: "Sept", loyal: 170, newItems: 270, unique: 110 },
  { name: "Oct", loyal: 190, newItems: 300, unique: 125 },
  { name: "Nov", loyal: 160, newItems: 260, unique: 95 },
  { name: "Dec", loyal: 210, newItems: 320, unique: 135 },
];

export function AnalyticsBarChart({
  title = "Incidents Overview",
  data = defaultData,
}: {
  title?: string;
  data?: BarChartData[];
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-baligo flex flex-col justify-between h-full w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
          {title}
        </h3>
        <span className="text-xs font-medium text-slate-400">Past 12 Months</span>
      </div>

      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            barGap={3}
            barCategoryGap="25%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#F1F4F9"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141738",
                borderRadius: "12px",
                border: "none",
                color: "#FFFFFF",
                fontSize: "12px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
              }}
              cursor={{ fill: "rgba(96, 82, 233, 0.04)" }}
            />
            <Bar
              dataKey="loyal"
              name="Internal"
              fill="#A7F3D0"
              radius={[4, 4, 0, 0]}
              stackId="a"
            />
            <Bar
              dataKey="newItems"
              name="Clinic Staff"
              fill="#4EE2CD"
              radius={[4, 4, 0, 0]}
              stackId="a"
            />
            <Bar
              dataKey="unique"
              name="Escalated"
              fill="#00D2B4"
              radius={[4, 4, 0, 0]}
              stackId="a"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#A7F3D0]" />
          <span>Internal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#4EE2CD]" />
          <span>Clinic Staff</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-xs bg-[#00D2B4]" />
          <span>Escalated</span>
        </div>
      </div>
    </div>
  );
}
