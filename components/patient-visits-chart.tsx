"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const data = [
  { month: "Jan", visits: 65 },
  { month: "Feb", visits: 59 },
  { month: "Mar", visits: 80 },
  { month: "Apr", visits: 81 },
  { month: "May", visits: 56 },
  { month: "Jun", visits: 55 },
  { month: "Jul", visits: 40 },
  { month: "Aug", visits: 70 },
  { month: "Sep", visits: 90 },
  { month: "Oct", visits: 110 },
  { month: "Nov", visits: 95 },
  { month: "Dec", visits: 85 },
]

export function PatientVisitsChart() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const gridColor = isDark ? "#2d3748" : "#f5f5f5"
  const textColor = isDark ? "#cbd5e0" : "#64748b"

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  return (
    <div className="h-[300px] w-full">
      {isMounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: textColor }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 12, fill: textColor }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1a202c" : "white",
                borderRadius: "8px",
                border: isDark ? "1px solid #2d3748" : "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                color: isDark ? "#e2e8f0" : "inherit",
              }}
            />
            <defs>
              <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007BFF" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#007BFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="visits"
              stroke="#007BFF"
              fill="url(#colorVisits)"
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center bg-muted/10 animate-pulse">Loading...</div>
      )}
    </div>
  )
}
