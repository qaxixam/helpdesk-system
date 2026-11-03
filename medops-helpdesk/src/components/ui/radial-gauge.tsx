"use client";

import React from "react";

interface RadialGaugeProps {
  title: string;
  percentage: number;
  strokeColor?: string;
  trackColor?: string;
  legendLabel?: string;
  size?: number;
  strokeWidth?: number;
}

export function RadialGauge({
  title,
  percentage,
  strokeColor = "#00C975",
  trackColor = "#F1F4F9",
  legendLabel = "Target",
  size = 140,
  strokeWidth = 14,
}: RadialGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Make an open circular arc / gauge (e.g., 270 deg or standard 360 ring)
  const clamped = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-baligo flex flex-col justify-between h-full">
      <div className="text-sm font-semibold text-slate-800 tracking-tight mb-4">
        {title}
      </div>

      <div className="flex items-center justify-center my-3 relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90 origin-center"
        >
          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated active progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {clamped}%
          </span>
        </div>
      </div>

      {/* Legend below */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100/80 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: strokeColor }}
          />
          <span className="font-medium text-slate-600">{legendLabel}</span>
        </div>
        <span className="font-bold text-slate-900">{clamped}%</span>
      </div>
    </div>
  );
}

