import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Settings, ArrowRight } from "lucide-react"
import { Chart } from "@/components/ui/chart"
import { TimeRangeSelector } from "@/components/time-range-selector"

export function FinancialOverview() {
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
        <div className="h-[240px] mt-4">
          <Chart
            options={{
              chart: {
                id: "financial-overview",
                toolbar: {
                  show: false,
                },
                zoom: {
                  enabled: false,
                },
              },
              stroke: {
                curve: "smooth",
                width: 3,
              },
              grid: {
                borderColor: "#f1f1f1",
                row: {
                  colors: ["transparent", "transparent"],
                  opacity: 0.5,
                },
              },
              xaxis: {
                categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
                labels: {
                  style: {
                    colors: "#6b7280",
                    fontSize: "12px",
                  },
                },
              },
              yaxis: {
                labels: {
                  style: {
                    colors: "#6b7280",
                    fontSize: "12px",
                  },
                  formatter: (value) => `$${value.toLocaleString()}`,
                },
              },
              tooltip: {
                y: {
                  formatter: (value) => `$${value.toLocaleString()}`,
                },
              },
              colors: ["#007BFF", "#FF6B6B", "#33CC5A"],
              legend: {
                position: "top",
                horizontalAlign: "right",
                floating: true,
                offsetY: -25,
                offsetX: -5,
              },
            }}
            series={[
              {
                name: "Revenue",
                data: [30500, 41200, 35800, 51200, 49000, 62500, 69000, 91000, 148000],
              },
              {
                name: "Expenses",
                data: [11000, 32000, 45000, 32000, 34000, 52000, 41000, 31000, 40000],
              },
              {
                name: "Profit",
                data: [19500, 9200, -9200, 19200, 15000, 10500, 28000, 60000, 108000],
              },
            ]}
            type="area"
            height="100%"
          />
        </div>
        <div className="grid grid-cols-3 gap-4 px-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold">$528,200</p>
            <p className="text-xs text-green-500 flex items-center">
              <span>+12.5%</span>
              <ArrowRight className="h-3 w-3 rotate-45 ml-1" />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold">$308,000</p>
            <p className="text-xs text-red-500 flex items-center">
              <span>+8.2%</span>
              <ArrowRight className="h-3 w-3 rotate-45 ml-1" />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Net Profit</p>
            <p className="text-xl font-bold">$220,200</p>
            <p className="text-xs text-green-500 flex items-center">
              <span>+18.3%</span>
              <ArrowRight className="h-3 w-3 rotate-45 ml-1" />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
