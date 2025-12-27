"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Settings, ArrowRight } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { TimeRangeSelector } from "@/components/time-range-selector"

interface FinancialData {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface FinancialOverviewProps {
  data?: FinancialData[]
  totalRevenue?: number
  totalExpenses?: number
  netProfit?: number
  revenueChange?: number
  expensesChange?: number
  profitChange?: number
}

export function FinancialOverview({
  data = [
    { month: "Jan", revenue: 30500, expenses: 11000, profit: 19500 },
    { month: "Feb", revenue: 41200, expenses: 32000, profit: 9200 },
    { month: "Mar", revenue: 35800, expenses: 45000, profit: -9200 },
    { month: "Apr", revenue: 51200, expenses: 32000, profit: 19200 },
    { month: "May", revenue: 49000, expenses: 34000, profit: 15000 },
    { month: "Jun", revenue: 62500, expenses: 52000, profit: 10500 },
    { month: "Jul", revenue: 69000, expenses: 41000, profit: 28000 },
    { month: "Aug", revenue: 91000, expenses: 31000, profit: 60000 },
    { month: "Sep", revenue: 148000, expenses: 40000, profit: 108000 },
  ],
  totalRevenue = 528200,
  totalExpenses = 308000,
  netProfit = 220200,
  revenueChange = 12.5,
  expensesChange = 8.2,
  profitChange = 18.3,
}: FinancialOverviewProps) {
  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString()}`
  }

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <Card className="col-span-12 lg:col-span-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-0">
          <CardTitle className="text-base font-medium">Financial Overview</CardTitle>
          <CardDescription>Track your practice's financial performance</CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Customize</span>
        </Button>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <div className="flex items-center justify-between px-4 pt-2">
          <TimeRangeSelector />
          <Tabs defaultValue="revenue" className="w-[400px]">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="profit">Profit</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="h-[240px] mt-4 w-full min-w-[300px]">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={formatCurrency}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#007BFF" 
                  fill="#007BFF" 
                  fillOpacity={0.6}
                  name="Revenue"
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#FF6B6B" 
                  fill="#FF6B6B" 
                  fillOpacity={0.6}
                  name="Expenses"
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#33CC5A" 
                  fill="#33CC5A" 
                  fillOpacity={0.6}
                  name="Profit"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
             <div className="flex items-center justify-center h-full bg-muted/20 text-muted-foreground animate-pulse rounded-md">
                Loading Chart...
             </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 px-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
            <p className={`text-xs flex items-center ${revenueChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <span>{revenueChange >= 0 ? '+' : ''}{revenueChange}%</span>
              <ArrowRight className={`h-3 w-3 ml-1 ${revenueChange >= 0 ? 'rotate-45' : '-rotate-45'}`} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold">{formatCurrency(totalExpenses)}</p>
            <p className={`text-xs flex items-center ${expensesChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              <span>{expensesChange >= 0 ? '+' : ''}{expensesChange}%</span>
              <ArrowRight className={`h-3 w-3 ml-1 ${expensesChange >= 0 ? 'rotate-45' : '-rotate-45'}`} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Net Profit</p>
            <p className="text-xl font-bold">{formatCurrency(netProfit)}</p>
            <p className={`text-xs flex items-center ${profitChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <span>{profitChange >= 0 ? '+' : ''}{profitChange}%</span>
              <ArrowRight className={`h-3 w-3 ml-1 ${profitChange >= 0 ? 'rotate-45' : '-rotate-45'}`} />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
