"use client"

import { useState } from "react"
import { Calendar, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const timeRanges = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This Week", value: "this-week" },
  { label: "Last Week", value: "last-week" },
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "This Year", value: "this-year" },
  { label: "Custom Range", value: "custom" },
]

export function TimeRangeSelector() {
  const [selectedRange, setSelectedRange] = useState(timeRanges[0])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 rounded-xl">
          <Calendar className="h-3.5 w-3.5" />
          <span>{selectedRange.label}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        {timeRanges.map((range) => (
          <DropdownMenuItem key={range.value} onClick={() => setSelectedRange(range)} className="cursor-pointer">
            {range.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
