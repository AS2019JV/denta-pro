"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar, Clock } from "lucide-react"

export function AppointmentList() {
  return (
    <Card className="col-span-12 lg:col-span-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-0">
          <CardTitle className="text-base font-medium">Appointments</CardTitle>
          <CardDescription>Today's schedule</CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => (window.location.href = "/calendar")}>
          <Calendar className="h-5 w-5" />
          <span className="sr-only">View Calendar</span>
        </Button>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <div className="space-y-4 h-[240px] overflow-auto px-4 py-2">
          {[
            {
              name: "Sarah Johnson",
              time: "9:00 AM",
              duration: "30 min",
              type: "Check-up",
              status: "confirmed",
            },
            {
              name: "Michael Chen",
              time: "10:00 AM",
              duration: "45 min",
              type: "Root Canal",
              status: "confirmed",
            },
            {
              name: "Emily Rodriguez",
              time: "11:15 AM",
              duration: "30 min",
              type: "Cleaning",
              status: "confirmed",
            },
            {
              name: "David Kim",
              time: "1:30 PM",
              duration: "60 min",
              type: "Wisdom Tooth",
              status: "pending",
            },
            {
              name: "Lisa Wang",
              time: "3:00 PM",
              duration: "45 min",
              type: "Filling",
              status: "confirmed",
            },
          ].map((appointment, i) => (
            <div key={i} className="flex items-center">
              <div className="flex items-center gap-4 flex-1">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={`/placeholder.svg?height=36&width=36&${i}`} alt={appointment.name} />
                  <AvatarFallback>
                    {appointment.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="grid gap-1">
                  <p className="text-sm font-medium leading-none">{appointment.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {appointment.time} • {appointment.duration} • {appointment.type}
                  </p>
                </div>
              </div>
              {appointment.status === "confirmed" ? (
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30">
                  <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="pt-4 px-4">
          <Button className="w-full" size="sm" onClick={() => (window.location.href = "/calendar")}>
            View All Appointments
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
