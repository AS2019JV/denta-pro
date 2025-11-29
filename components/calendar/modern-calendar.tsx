"use client"

import { CardHeader } from "@/components/ui/card"

import { useState, useEffect, useRef } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isToday,
  addDays,
  startOfWeek,
  endOfWeek,
  isBefore,
  isAfter,
  differenceInMinutes,
  getHours,
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus, Clock, CalendarIcon, Settings, Users, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

// Sample appointment data
const initialAppointments = [
  {
    id: "1",
    patientName: "Sarah Johnson",
    patientId: "PT-10045",
    startTime: "2025-04-02T09:00:00",
    endTime: "2025-04-02T10:00:00",
    treatment: "Cleaning",
    amount: "$120",
    color: "#007BFF",
    dentist: "Dr. Johnson",
    notes: "Regular cleaning appointment. Patient has sensitive teeth.",
    status: "confirmed",
  },
  {
    id: "2",
    patientName: "Michael Chen",
    patientId: "PT-10046",
    startTime: "2025-04-02T11:30:00",
    endTime: "2025-04-02T13:00:00",
    treatment: "Root Canal",
    amount: "$850",
    color: "#28A745",
    dentist: "Dr. Martinez",
    notes: "Root canal treatment for upper right molar. Patient is anxious about procedure.",
    status: "confirmed",
  },
  {
    id: "3",
    patientName: "Emily Rodriguez",
    patientId: "PT-10047",
    startTime: "2025-04-03T14:00:00",
    endTime: "2025-04-03T15:00:00",
    treatment: "Consultation",
    amount: "$75",
    color: "#2D9CDB",
    dentist: "Dr. Johnson",
    notes: "Initial consultation for orthodontic treatment.",
    status: "pending",
  },
  {
    id: "4",
    patientName: "David Kim",
    patientId: "PT-10048",
    startTime: "2025-04-05T10:00:00",
    endTime: "2025-04-05T11:00:00",
    treatment: "Filling",
    amount: "$200",
    color: "#007BFF",
    dentist: "Dr. Wilson",
    notes: "Filling for cavity on lower left molar.",
    status: "confirmed",
  },
  {
    id: "5",
    patientName: "Lisa Wang",
    patientId: "PT-10049",
    startTime: "2025-04-08T15:30:00",
    endTime: "2025-04-08T16:30:00",
    treatment: "Cleaning",
    amount: "$120",
    color: "#007BFF",
    dentist: "Dr. Martinez",
    notes: "Regular cleaning appointment.",
    status: "pending",
  },
]

// Sample patients data
const patients = [
  { id: "PT-10045", name: "Sarah Johnson", avatar: "SJ" },
  { id: "PT-10046", name: "Michael Chen", avatar: "MC" },
  { id: "PT-10047", name: "Emily Rodriguez", avatar: "ER" },
  { id: "PT-10048", name: "David Kim", avatar: "DK" },
  { id: "PT-10049", name: "Lisa Wang", avatar: "LW" },
  { id: "PT-10050", name: "Robert Garcia", avatar: "RG" },
  { id: "PT-10051", name: "Jennifer Lee", avatar: "JL" },
  { id: "PT-10052", name: "Thomas Wilson", avatar: "TW" },
]

// Sample dentists data
const dentists = [
  { id: "DR-001", name: "Dr. Johnson", avatar: "DJ", color: "#4361EE", available: true },
  { id: "DR-002", name: "Dr. Martinez", avatar: "DM", color: "#3A0CA3", available: true },
  { id: "DR-003", name: "Dr. Wilson", avatar: "DW", color: "#7209B7", available: true },
  { id: "DR-004", name: "Dr. Thompson", avatar: "DT", color: "#F72585", available: false },
  { id: "DR-005", name: "Dr. Garcia", avatar: "DG", color: "#4CC9F0", available: true },
]

// Treatment types
const treatmentTypes = [
  { id: "cleaning", name: "Cleaning", color: "#007BFF", duration: 60, price: 120 },
  { id: "consultation", name: "Consultation", color: "#2D9CDB", duration: 60, price: 75 },
  { id: "rootcanal", name: "Root Canal", color: "#28A745", duration: 90, price: 850 },
  { id: "filling", name: "Filling", color: "#FFC107", duration: 60, price: 200 },
  { id: "extraction", name: "Extraction", color: "#DC3545", duration: 45, price: 250 },
  { id: "crown", name: "Crown", color: "#6C757D", duration: 90, price: 950 },
]

interface Appointment {
  id: string
  patientName: string
  patientId: string
  startTime: string
  endTime: string
  treatment: string
  amount: string
  color: string
  dentist: string
  dentistId: string
  notes: string
  status: string
}

interface ModernCalendarProps {
  appointments?: Appointment[]
  onDateSelect?: (date: Date) => void
  onAppointmentClick?: (appointment: Appointment) => void
  onAppointmentCreate?: (appointment: any) => void
  initialView?: "month" | "week" | "today"
}

export function ModernCalendar({
  appointments: propAppointments = [],
  onDateSelect,
  onAppointmentClick,
  onAppointmentCreate,
  initialView = "month",
}: ModernCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [appointments, setAppointments] = useState(propAppointments)

  useEffect(() => {
    setAppointments(propAppointments)
  }, [propAppointments])
  const [view, setView] = useState<"month" | "week" | "today" | "list" | "timeline">(initialView)
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false)
  const [showAppointmentDetails, setShowAppointmentDialog] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null)
  const [businessHours, setBusinessHours] = useState({ start: 7, end: 19 }) // 7am to 7pm
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showDentistsDialog, setShowDentistsDialog] = useState(false)
  const [showHoursDialog, setShowHoursDialog] = useState(false)
  const [selectedDentists, setSelectedDentists] = useState<string[]>(
    dentists.filter((d) => d.available).map((d) => d.id),
  )
  const [isMonthChanging, setIsMonthChanging] = useState(false)
  const [monthChangeDirection, setMonthChangeDirection] = useState<"left" | "right" | null>(null)
  const [calendarDays, setCalendarDays] = useState<Date[]>([])
  const weekViewRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const [newAppointment, setNewAppointment] = useState({
    patientId: "",
    patientName: "",
    treatment: "cleaning",
    date: format(selectedDate, "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    notes: "",
    dentistId: dentists[0].id,
    customStartTime: {
      hours: 9,
      minutes: 0,
    },
    customEndTime: {
      hours: 10,
      minutes: 0,
    },
  })

  // Generate calendar days when current date changes
  useEffect(() => {
    if (view === "month") {
      const days = generateMonthDays()
      setCalendarDays(days)
    } else if (view === "week") {
      const days = generateWeekDays()
      setCalendarDays(days)
    }
  }, [currentDate, view])

  // Generate time slots based on business hours
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = businessHours.start; hour < businessHours.end; hour++) {
      slots.push(`${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? "AM" : "PM"}`)
      slots.push(`${hour % 12 === 0 ? 12 : hour % 12}:30 ${hour < 12 ? "AM" : "PM"}`)
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Update the selected date when it changes
  useEffect(() => {
    if (onDateSelect) {
      onDateSelect(selectedDate)
    }
  }, [selectedDate, onDateSelect])

  // Handle month navigation with animation
  const nextMonth = () => {
    setMonthChangeDirection("right")
    setIsMonthChanging(true)
    setTimeout(() => {
      setCurrentDate(addMonths(currentDate, 1))
      setIsMonthChanging(false)
    }, 300)
  }

  const prevMonth = () => {
    setMonthChangeDirection("left")
    setIsMonthChanging(true)
    setTimeout(() => {
      setCurrentDate(subMonths(currentDate, 1))
      setIsMonthChanging(false)
    }, 300)
  }

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    if (view === "month") {
      setView("today")
    }
  }

  // Handle appointment click
  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment)
    setShowAppointmentDialog(true)
    if (onAppointmentClick) {
      onAppointmentClick(appointment)
    }
  }

  // Format time from hours and minutes
  const formatTimeFromComponents = (hours: number, minutes: number) => {
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 === 0 ? 12 : hours % 12
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes
    return `${displayHours}:${displayMinutes} ${period}`
  }

  // Create a new appointment
  const handleCreateAppointment = () => {
    // Find the selected patient
    const patient = patients.find((p) => p.id === newAppointment.patientId)
    const treatment = treatmentTypes.find((t) => t.id === newAppointment.treatment)
    const dentist = dentists.find((d) => d.id === newAppointment.dentistId)

    if (!patient || !treatment || !dentist) return

    // Create appointment date from selected date and custom time
    const startDate = new Date(newAppointment.date)
    startDate.setHours(newAppointment.customStartTime.hours, newAppointment.customStartTime.minutes, 0, 0)

    // Calculate end time
    const endDate = new Date(newAppointment.date)
    endDate.setHours(newAppointment.customEndTime.hours, newAppointment.customEndTime.minutes, 0, 0)

    const newAppt = {
      id: `temp-${Date.now()}`,
      patientName: patient.name,
      patientId: patient.id,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      treatment: treatment.name,
      amount: `$${treatment.price}`,
      color: treatment.color,
      dentist: dentist.name,
      dentistId: dentist.id,
      notes: newAppointment.notes,
      status: "pending",
    }

    setAppointments([...appointments, newAppt])
    setShowNewAppointmentDialog(false)

    if (onAppointmentCreate) {
      onAppointmentCreate(newAppt)
    }

    // Reset form
    setNewAppointment({
      patientId: "",
      patientName: "",
      treatment: "cleaning",
      date: format(selectedDate, "yyyy-MM-dd"),
      startTime: "",
      endTime: "",
      notes: "",
      dentistId: dentists[0].id,
      customStartTime: {
        hours: 9,
        minutes: 0,
      },
      customEndTime: {
        hours: 10,
        minutes: 0,
      },
    })
  }

  // Delete an appointment
  const handleDeleteAppointment = (id: string) => {
    setAppointments(appointments.filter((appt) => appt.id !== id))
    setShowAppointmentDialog(false)
  }

  // Get appointments for a specific date
  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter((appointment) => {
      const appointmentDate = parseISO(appointment.startTime)
      return isSameDay(appointmentDate, date)
    })
  }

  // Filter appointments based on search and filters
  const filterAppointments = (appts: typeof appointments) => {
    return appts.filter((appt) => {
      const matchesSearch =
        searchQuery === "" ||
        appt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appt.treatment.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appt.dentist.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = filterStatus === null || appt.status === filterStatus

      const matchesDentist = selectedDentists.includes(appt.dentistId)

      return matchesSearch && matchesStatus && matchesDentist
    })
  }

  // Generate the days for the month view
  const generateMonthDays = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Add days from previous and next month to fill the calendar grid
    const startDay = monthStart.getDay()
    const endDay = 6 - monthEnd.getDay()

    const prevMonthDays =
      startDay > 0
        ? eachDayOfInterval({
            start: addDays(monthStart, -startDay),
            end: addDays(monthStart, -1),
          })
        : []

    const nextMonthDays =
      endDay > 0
        ? eachDayOfInterval({
            start: addDays(monthEnd, 1),
            end: addDays(monthEnd, endDay),
          })
        : []

    return [...prevMonthDays, ...days, ...nextMonthDays]
  }

  // Generate the days for the week view
  const generateWeekDays = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 }) // Start on Sunday
    return eachDayOfInterval({
      start: weekStart,
      end: endOfWeek(weekStart, { weekStartsOn: 0 }),
    })
  }

  // Update business hours
  const updateBusinessHours = (start: number, end: number) => {
    setBusinessHours({ start, end })
    setShowSettingsDialog(false)
  }

  // Get color for appointment based on dentist
  const getAppointmentColor = (appointment: any) => {
    const dentist = dentists.find((d) => d.id === appointment.dentistId || d.name === appointment.dentist)
    return dentist?.color || appointment.color
  }

  // Group appointments by time period (AM/PM)
  const groupAppointmentsByTimePeriod = (dayAppointments: typeof appointments) => {
    const morningAppointments = dayAppointments.filter((appt) => {
      const hour = getHours(parseISO(appt.startTime))
      return hour < 12
    })

    const afternoonAppointments = dayAppointments.filter((appt) => {
      const hour = getHours(parseISO(appt.startTime))
      return hour >= 12 && hour < 17
    })

    const eveningAppointments = dayAppointments.filter((appt) => {
      const hour = getHours(parseISO(appt.startTime))
      return hour >= 17
    })

    return {
      morning: morningAppointments,
      afternoon: afternoonAppointments,
      evening: eveningAppointments,
    }
  }

  // Render the month view
  const renderMonthView = () => {
    const days = calendarDays

    return (
      <div
        className={cn(
          "transition-opacity duration-300 ease-in-out",
          isMonthChanging ? "opacity-0" : "opacity-100",
          monthChangeDirection === "left" ? "translate-x-4" : monthChangeDirection === "right" ? "-translate-x-4" : "",
        )}
      >
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {days.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isSelected = isSameDay(day, selectedDate)
            const dayAppointments = getAppointmentsForDate(day)
            const filteredAppointments = filterAppointments(dayAppointments)
            const appointmentCount = filteredAppointments.length

            return (
              <div
                key={i}
                className={cn(
                  "h-24 p-1 border rounded-md transition-all duration-200",
                  isCurrentMonth ? "bg-card" : "bg-muted/20",
                  isSelected ? "ring-2 ring-primary bg-primary/10" : "",
                  isToday(day) ? "border-primary" : "border-border",
                  "hover:bg-muted/30 cursor-pointer hover:scale-[1.02] hover:shadow-sm",
                )}
                onClick={() => handleDateSelect(day)}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday(day) ? "bg-primary text-primary-foreground" : "",
                      !isCurrentMonth ? "text-muted-foreground" : "",
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {appointmentCount > 0 && <Badge className="text-[10px] h-5">{appointmentCount}</Badge>}
                </div>

                {/* Show up to 3 appointments */}
                <div className="mt-1 space-y-1 overflow-hidden">
                  {filteredAppointments.slice(0, 2).map((appointment: Appointment, idx: number) => (
                    <div
                      key={idx}
                      className="text-[10px] truncate px-1.5 py-0.5 rounded-sm flex items-center gap-1"
                      style={{ backgroundColor: `${getAppointmentColor(appointment)}20` }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAppointmentClick(appointment)
                      }}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getAppointmentColor(appointment) }}
                      />
                      <span className="truncate">
                        {format(parseISO(appointment.startTime), "h:mm a")} - {appointment.patientName}
                      </span>
                    </div>
                  ))}

                  {appointmentCount > 2 && (
                    <div className="text-[10px] text-muted-foreground text-center">+{appointmentCount - 2} más</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render the week view
  const renderWeekView = () => {
    const days = generateWeekDays()
    const hourHeight = 60 // Height per hour in pixels

    return (
      <div className="flex flex-col">
        {/* Day headers */}
        <div className="grid grid-cols-8 gap-1 border-b">
          <div className="text-center py-2 text-sm font-medium text-muted-foreground">
            <div>Hora</div>
          </div>
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                "text-center py-2 text-sm font-medium border-b",
                isSameDay(day, selectedDate)
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent",
                isToday(day) ? "bg-primary/5 rounded-t-md" : "",
              )}
              onClick={() => handleDateSelect(day)}
            >
              <div>{format(day, "EEE", { locale: es })}</div>
              <div
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm mt-1 transition-transform hover:scale-110",
                  isToday(day) ? "bg-primary text-primary-foreground" : "",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots and appointments */}
        <div
          className="grid grid-cols-8 gap-1 overflow-auto relative"
          style={{ height: `${(businessHours.end - businessHours.start) * hourHeight + 20}px` }}
          ref={weekViewRef}
        >
          {/* Time column */}
          <div className="col-span-1 relative">
            {Array.from({ length: (businessHours.end - businessHours.start) * 2 }).map((_, i) => {
              const hour = Math.floor(i / 2) + businessHours.start
              const minute = i % 2 === 0 ? 0 : 30
              const timeLabel = `${hour % 12 === 0 ? 12 : hour % 12}:${minute === 0 ? "00" : "30"} ${hour < 12 ? "AM" : "PM"}`

              return (
                <div
                  key={i}
                  className="border-b border-dashed h-[30px] px-1 text-[10px] text-muted-foreground sticky left-0 bg-background z-10"
                >
                  {minute === 0 && <span className="absolute left-1 top-0">{timeLabel}</span>}
                </div>
              )
            })}
          </div>

          {/* Day columns with appointments */}
          {days.map((day, dayIndex) => {
            const dayAppointments = getAppointmentsForDate(day)
            const filteredAppointments = filterAppointments(dayAppointments)

            return (
              <div key={dayIndex} className={cn("col-span-1 relative border-l", dayIndex === 0 ? "border-l-0" : "")}>
                {/* Time grid */}
                {Array.from({ length: (businessHours.end - businessHours.start) * 2 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "border-b border-dashed h-[30px] hover:bg-muted/20 transition-colors",
                      Math.floor(i / 2) % 2 === 0 ? "bg-muted/5" : "",
                    )}
                    onClick={() => {
                      const hour = Math.floor(i / 2) + businessHours.start
                      const minute = i % 2 === 0 ? 0 : 30

                      setSelectedDate(day)
                      setNewAppointment({
                        ...newAppointment,
                        date: format(day, "yyyy-MM-dd"),
                        customStartTime: {
                          hours: hour,
                          minutes: minute,
                        },
                        customEndTime: {
                          hours: hour + 1,
                          minutes: minute,
                        },
                      })
                      setShowNewAppointmentDialog(true)
                    }}
                  />
                ))}

                {/* Current time indicator */}
                {isToday(day) && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-red-500 z-10 pointer-events-none"
                    style={{
                      top: `${(new Date().getHours() + new Date().getMinutes() / 60 - businessHours.start) * hourHeight}px`,
                    }}
                  >
                    <div className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
                  </div>
                )}

                {/* Render appointments */}
                {filteredAppointments.map((appointment, idx) => {
                  const startTime = parseISO(appointment.startTime)
                  const endTime = parseISO(appointment.endTime)
                  const startHour = startTime.getHours() + startTime.getMinutes() / 60
                  const endHour = endTime.getHours() + endTime.getMinutes() / 60
                  const duration = endHour - startHour

                  // Calculate position and height
                  const top = (startHour - businessHours.start) * hourHeight
                  const height = duration * hourHeight

                  return (
                    <div
                      key={idx}
                      className="absolute left-1 right-1 rounded-md px-1 py-0.5 text-[10px] overflow-hidden cursor-pointer z-20 shadow-sm hover:shadow-md transition-shadow"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: getAppointmentColor(appointment),
                        color: "white",
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAppointmentClick(appointment)
                      }}
                    >
                      <div className="font-medium">{appointment.patientName}</div>
                      <div>
                        {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                      </div>
                      <div>{appointment.treatment}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render the day view (now "Today" view)
  const renderTodayView = () => {
    const dayAppointments = getAppointmentsForDate(selectedDate)
    const filteredAppointments = filterAppointments(dayAppointments)
    const groupedAppointments = groupAppointmentsByTimePeriod(filteredAppointments)
    const hourHeight = 60 // Height per hour in pixels
    const now = new Date()

    // Calculate progress percentage through the working day
    const calculateDayProgress = () => {
      if (!isToday(selectedDate)) return 0

      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const currentTimeDecimal = currentHour + currentMinute / 60

      if (currentTimeDecimal < businessHours.start) return 0
      if (currentTimeDecimal > businessHours.end) return 100

      return ((currentTimeDecimal - businessHours.start) / (businessHours.end - businessHours.start)) * 100
    }

    // Function to navigate to previous/next day
    const navigateDay = (direction: "prev" | "next") => {
      setSelectedDate(direction === "prev" ? addDays(selectedDate, -1) : addDays(selectedDate, 1))
    }

    // Render a time section with appointments
    const renderTimeSection = (title: string, appointments: typeof filteredAppointments, color: string) => {
      if (appointments.length === 0) return null

      return (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <h3 className="text-sm font-medium">{title}</h3>
          </div>
          <div className="space-y-3 pl-6 border-l-2" style={{ borderColor: `${color}40` }}>
            {appointments.map((appointment, idx) => {
              const startTime = parseISO(appointment.startTime)
              const endTime = parseISO(appointment.endTime)

              return (
                <div
                  key={idx}
                  className="bg-card rounded-lg border shadow-sm hover:shadow-md transition-all p-3 relative overflow-hidden group"
                  onClick={() => handleAppointmentClick(appointment)}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: getAppointmentColor(appointment) }}
                  />
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{appointment.patientName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")} • {appointment.treatment}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{appointment.dentist}</p>
                    </div>
                    <div>
                      {appointment.status === "confirmed" ? (
                        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-green-100 dark:bg-green-900/30">
                          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-orange-100 dark:bg-orange-900/30">
                          <Clock className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: getAppointmentColor(appointment) }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Day header with centered date */}
        <div className="md:col-span-4 flex flex-col items-center justify-center py-2">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDay("prev")}
              className="h-10 w-10 rounded-full hover:bg-primary/10 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-16 w-16 flex items-center justify-center rounded-full text-2xl font-semibold mb-1 transition-transform hover:scale-105",
                  isToday(selectedDate) ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {format(selectedDate, "d")}
              </div>
              <div className="font-medium text-lg">{format(selectedDate, "EEEE", { locale: es })}</div>
              <div className="text-sm text-muted-foreground">{format(selectedDate, "MMMM yyyy", { locale: es })}</div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDay("next")}
              className="h-10 w-10 rounded-full hover:bg-primary/10 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Button onClick={() => setShowNewAppointmentDialog(true)} size="sm" className="mt-4">
            <Plus className="h-4 w-4 mr-1" /> Nueva Cita
          </Button>
        </div>

        {/* Main calendar grid */}
        <div className="md:col-span-3">
          <Card className="overflow-hidden">
            {/* Progress bar */}
            {isToday(selectedDate) && (
              <div className="h-1.5 bg-muted relative">
                <div
                  className="absolute h-full bg-primary transition-all duration-500 ease-in-out"
                  style={{ width: `${calculateDayProgress()}%` }}
                />
              </div>
            )}

            <div className="p-4">
              {/* Timeline visualization with sections */}
              <div className="relative pl-6">
                {/* Vertical timeline line with gradient */}
                <div className="absolute top-0 left-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-primary/20"></div>

                {/* Morning section */}
                {renderTimeSection("Mañana (AM)", groupedAppointments.morning, "#4361EE")}

                {/* Afternoon section */}
                {renderTimeSection("Tarde (PM)", groupedAppointments.afternoon, "#3A0CA3")}

                {/* Evening section */}
                {renderTimeSection("Noche", groupedAppointments.evening, "#7209B7")}

                {/* Empty state */}
                {filteredAppointments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No hay citas programadas para este día</p>
                    <Button onClick={() => setShowNewAppointmentDialog(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Añadir Cita
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Appointments sidebar */}
        <div className="md:col-span-1">
          <Card className="h-[600px] overflow-hidden">
            <div className="p-4 border-b bg-muted/10">
              <h3 className="font-medium">Citas</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredAppointments.length} citas para {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
              </p>
            </div>

            <div className="overflow-auto h-[calc(100%-60px)]">
              {filteredAppointments.length > 0 ? (
                <div className="divide-y">
                  {filteredAppointments.map((appointment, idx) => {
                    const startTime = parseISO(appointment.startTime)
                    const endTime = parseISO(appointment.endTime)

                    return (
                      <div
                        key={idx}
                        className="p-3 hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => handleAppointmentClick(appointment)}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="w-1 h-full min-h-[40px] rounded-full mr-2"
                            style={{ backgroundColor: getAppointmentColor(appointment) }}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{appointment.patientName}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                            </div>
                            <div className="text-xs mt-1 flex items-center">
                              <span
                                className="inline-block w-2 h-2 rounded-full mr-1"
                                style={{ backgroundColor: getAppointmentColor(appointment) }}
                              />
                              {appointment.treatment}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{appointment.dentist}</div>
                          </div>
                          <div className="ml-2">
                            {appointment.status === "confirmed" ? (
                              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30">
                                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-orange-100 dark:bg-orange-900/30">
                                <Clock className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-4">
                    <p className="text-muted-foreground">No hay citas para este día</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setShowNewAppointmentDialog(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Añadir Cita
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Render list view
  const renderListView = () => {
    // Filter appointments for the current week
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 })

    const weekAppointments = appointments.filter((appointment) => {
      const appointmentDate = parseISO(appointment.startTime)
      return !isBefore(appointmentDate, weekStart) && !isAfter(appointmentDate, weekEnd)
    })

    const filteredAppointments = filterAppointments(weekAppointments)

    // Group appointments by day
    const appointmentsByDay = filteredAppointments.reduce(
      (acc, appointment) => {
        const day = format(parseISO(appointment.startTime), "yyyy-MM-dd")
        if (!acc[day]) {
          acc[day] = []
        }
        acc[day].push(appointment)
        return acc
      },
      {} as Record<string, typeof appointments>,
    )

    // Sort appointments by time
    Object.keys(appointmentsByDay).forEach((day) => {
      appointmentsByDay[day].sort((a: Appointment, b: Appointment) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      })
    })

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar citas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[250px]"
            />
            <Select value={filterStatus || "all"} onValueChange={(value) => setFilterStatus(value || null)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="confirmed">Confirmados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowNewAppointmentDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nueva Cita
          </Button>
        </div>

        {Object.keys(appointmentsByDay).length > 0 ? (
          <div className="space-y-6">
            {Object.keys(appointmentsByDay)
              .sort()
              .map((day) => {
                const date = new Date(day)
                return (
                  <Card key={day} className="overflow-hidden">
                    <CardHeader className="bg-muted/10 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center",
                            isToday(date) ? "bg-primary text-primary-foreground" : "bg-muted",
                          )}
                        >
                          {format(date, "d")}
                        </div>
                        <div>
                          <h3 className="font-medium">{format(date, "EEEE", { locale: es })}</h3>
                          <p className="text-xs text-muted-foreground">
                            {format(date, "d 'de' MMMM, yyyy", { locale: es })}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <div className="divide-y">
                      {appointmentsByDay[day].map((appointment, idx) => {
                        const startTime = parseISO(appointment.startTime)
                        const endTime = parseISO(appointment.endTime)
                        const duration = differenceInMinutes(endTime, startTime)

                        return (
                          <div
                            key={idx}
                            className="p-4 hover:bg-muted/10 cursor-pointer transition-colors"
                            onClick={() => handleAppointmentClick(appointment)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-center w-16">
                                <div className="text-sm font-medium">{format(startTime, "h:mm")}</div>
                                <div className="text-xs text-muted-foreground">{format(startTime, "a")}</div>
                              </div>

                              <div
                                className="w-1 h-full min-h-[50px] rounded-full"
                                style={{ backgroundColor: getAppointmentColor(appointment) }}
                              />

                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium">{appointment.patientName}</div>
                                  <div>
                                    {appointment.status === "confirmed" ? (
                                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                        Confirmado
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                        Pendiente
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 mt-1">
                                  <div className="text-sm">
                                    {appointment.treatment} • {duration} min
                                  </div>
                                  <div className="text-sm text-muted-foreground">{appointment.dentist}</div>
                                </div>

                                <div className="text-xs text-muted-foreground mt-1">{appointment.patientId}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )
              })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">No hay citas para esta semana</p>
              <Button onClick={() => setShowNewAppointmentDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> Añadir Cita
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render timeline view
  const renderTimelineView = () => {
    // Filter appointments for all dentists
    const filteredAppointments = filterAppointments(appointments)

    // Group appointments by dentist
    const appointmentsByDentist = filteredAppointments.reduce(
      (acc, appointment) => {
        const dentistId = appointment.dentistId
        if (!acc[dentistId]) {
          acc[dentistId] = []
        }
        acc[dentistId].push(appointment)
        return acc
      },
      {} as Record<string, typeof appointments>,
    )

    // Get dentist info
    const getDentistInfo = (dentistId: string) => {
      return (
        dentists.find((d) => d.id === dentistId) || {
          id: dentistId,
          name: "Unknown",
          avatar: "UN",
          color: "#999",
          available: true,
        }
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar citas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[250px]"
            />
            <Select value={filterStatus || "all"} onValueChange={(value) => setFilterStatus(value || null)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="confirmed">Confirmados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowNewAppointmentDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nueva Cita
          </Button>
        </div>

        <div className="space-y-6">
          {Object.keys(appointmentsByDentist).map((dentistId) => {
            const dentist = getDentistInfo(dentistId)
            const dentistAppointments = appointmentsByDentist[dentistId]

            // Group appointments by day
            const appointmentsByDay = dentistAppointments.reduce(
              (acc, appointment) => {
                const day = format(parseISO(appointment.startTime), "yyyy-MM-dd")
                if (!acc[day]) {
                  acc[day] = []
                }
                acc[day].push(appointment)
                return acc
              },
              {} as Record<string, typeof appointments>,
            )

            return (
              <Card key={dentistId} className="overflow-hidden">
                <CardHeader className="bg-muted/10 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback style={{ backgroundColor: dentist.color, color: "white" }}>
                        {dentist.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{dentist.name}</h3>
                      <p className="text-xs text-muted-foreground">{dentistAppointments.length} citas programadas</p>
                    </div>
                  </div>
                </CardHeader>

                <div className="p-4">
                  {Object.keys(appointmentsByDay).length > 0 ? (
                    <div className="space-y-6">
                      {Object.keys(appointmentsByDay)
                        .sort()
                        .map((day) => {
                          const date = new Date(day)
                          return (
                            <div key={day} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "h-6 w-6 rounded-full flex items-center justify-center text-xs",
                                    isToday(date) ? "bg-primary text-primary-foreground" : "bg-muted",
                                  )}
                                >
                                  {format(date, "d")}
                                </div>
                                <h4 className="text-sm font-medium">
                                  {format(date, "EEEE, d 'de' MMMM", { locale: es })}
                                </h4>
                              </div>

                              <div className="ml-8 border-l-2 pl-4 space-y-4" style={{ borderColor: dentist.color }}>
                                {appointmentsByDay[day]
                                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                  .map((appointment, idx) => {
                                    const startTime = parseISO(appointment.startTime)
                                    const endTime = parseISO(appointment.endTime)

                                    return (
                                      <div
                                        key={idx}
                                        className="relative bg-card border rounded-md p-3 hover:shadow-md cursor-pointer transition-all"
                                        onClick={() => handleAppointmentClick(appointment)}
                                      >
                                        <div
                                          className="absolute -left-6 top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full"
                                          style={{ backgroundColor: dentist.color }}
                                        />

                                        <div className="flex items-center justify-between">
                                          <div className="font-medium">{appointment.patientName}</div>
                                          <div>
                                            {appointment.status === "confirmed" ? (
                                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                                Confirmado
                                              </Badge>
                                            ) : (
                                              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                                Pendiente
                                              </Badge>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 mt-1 text-sm">
                                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span>
                                            {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                                          </span>
                                          <span className="text-muted-foreground">•</span>
                                          <span>{appointment.treatment}</span>
                                        </div>

                                        <div className="text-xs text-muted-foreground mt-1">
                                          {appointment.patientId}
                                        </div>
                                      </div>
                                    )
                                  })}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[100px]">
                      <p className="text-muted-foreground">No hay citas programadas</p>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}

          {Object.keys(appointmentsByDentist).length === 0 && (
            <div className="flex items-center justify-center h-[400px]">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">No hay citas que coincidan con los filtros</p>
                <Button onClick={() => setShowNewAppointmentDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Añadir Cita
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="transition-transform hover:scale-105">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">{format(currentDate, "MMMM yyyy", { locale: es })}</h2>
          <Button variant="outline" size="icon" onClick={nextMonth} className="transition-transform hover:scale-105">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Group 1: View buttons */}
          <div className="bg-muted/20 rounded-lg p-1 flex items-center">
            <Button
              variant={view === "today" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setSelectedDate(new Date())
                setView("today")
              }}
              className="transition-transform hover:scale-105"
            >
              Hoy
            </Button>
            <Button
              variant={view === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("week")}
              className="transition-transform hover:scale-105"
            >
              Semana
            </Button>
            <Button
              variant={view === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("month")}
              className="transition-transform hover:scale-105"
            >
              Mes
            </Button>
          </div>

          {/* Group 2: List/Timeline */}
          <div className="bg-muted/20 rounded-lg p-1 flex items-center">
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              className="transition-transform hover:scale-105"
            >
              Lista
            </Button>
            <Button
              variant={view === "timeline" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("timeline")}
              className="transition-transform hover:scale-105"
            >
              Timeline
            </Button>
          </div>

          {/* Group 3: Settings buttons */}
          <div className="bg-muted/20 rounded-lg p-1 flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDentistsDialog(true)}
              className="transition-transform hover:scale-105"
            >
              <Users className="mr-2 h-4 w-4" />
              Dentistas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHoursDialog(true)}
              className="transition-transform hover:scale-105"
            >
              <Clock className="mr-2 h-4 w-4" />
              Horario
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettingsDialog(true)}
              className="transition-transform hover:scale-105"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div>
        {view === "month" && renderMonthView()}
        {view === "week" && renderWeekView()}
        {view === "today" && renderTodayView()}
        {view === "list" && renderListView()}
        {view === "timeline" && renderTimelineView()}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configuración del Calendario</DialogTitle>
            <DialogDescription>Personaliza la vista de tu calendario y horario de trabajo</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Horario de Trabajo</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Inicio: {businessHours.start}:00 {businessHours.start < 12 ? "AM" : "PM"}
                </span>
                <span className="text-sm">
                  Fin: {businessHours.end}:00 {businessHours.end < 12 ? "AM" : "PM"}
                </span>
              </div>
              <div className="pt-4">
                <Slider
                  defaultValue={[businessHours.start, businessHours.end]}
                  min={0}
                  max={24}
                  step={1}
                  onValueChange={(values) => {
                    if (values[1] - values[0] >= 2) {
                      // Ensure at least 2 hours difference
                      setBusinessHours({ start: values[0], end: values[1] })
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowSettingsDialog(false)}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dentists Dialog */}
      <Dialog open={showDentistsDialog} onOpenChange={setShowDentistsDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gestionar Dentistas</DialogTitle>
            <DialogDescription>Selecciona los dentistas que quieres mostrar en el calendario</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              {dentists.map((dentist) => (
                <div
                  key={dentist.id}
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback style={{ backgroundColor: dentist.color, color: "white" }}>
                        {dentist.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{dentist.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {dentist.available ? "Disponible" : "No disponible"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selectedDentists.includes(dentist.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedDentists([...selectedDentists, dentist.id])
                        } else {
                          setSelectedDentists(selectedDentists.filter((id) => id !== dentist.id))
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDentistsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowDentistsDialog(false)}>Aplicar Filtros</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hours Dialog */}
      <Dialog open={showHoursDialog} onOpenChange={setShowHoursDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Horario de Trabajo</DialogTitle>
            <DialogDescription>Configura el horario de trabajo para el calendario</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Horario de Trabajo</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  Inicio: {businessHours.start}:00 {businessHours.start < 12 ? "AM" : "PM"}
                </span>
                <span className="text-sm">
                  Fin: {businessHours.end}:00 {businessHours.end < 12 ? "AM" : "PM"}
                </span>
              </div>
              <div className="pt-4">
                <Slider
                  defaultValue={[businessHours.start, businessHours.end]}
                  min={0}
                  max={24}
                  step={1}
                  onValueChange={(values) => {
                    if (values[1] - values[0] >= 2) {
                      // Ensure at least 2 hours difference
                      setBusinessHours({ start: values[0], end: values[1] })
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Días Laborables</Label>
              <div className="grid grid-cols-7 gap-2">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day, index) => (
                  <div key={day} className="flex flex-col items-center">
                    <div className="text-xs text-muted-foreground mb-1">{day}</div>
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center cursor-pointer transition-colors",
                        index === 0 || index === 6 ? "bg-muted/20" : "bg-primary/20 text-primary",
                      )}
                    >
                      <Check className={cn("h-4 w-4", index === 0 || index === 6 ? "opacity-0" : "opacity-100")} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHoursDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowHoursDialog(false)}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Appointment Dialog */}
      <Dialog open={showNewAppointmentDialog} onOpenChange={setShowNewAppointmentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nueva Cita</DialogTitle>
            <DialogDescription>
              Crear una nueva cita para {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="patient">Paciente</Label>
              <Select
                value={newAppointment.patientId}
                onValueChange={(value) => setNewAppointment({ ...newAppointment, patientId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">{patient.avatar}</AvatarFallback>
                        </Avatar>
                        <span>{patient.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dentist">Dentista</Label>
              <Select
                value={newAppointment.dentistId}
                onValueChange={(value) => setNewAppointment({ ...newAppointment, dentistId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar dentista" />
                </SelectTrigger>
                <SelectContent>
                  {dentists
                    .filter((d) => d.available)
                    .map((dentist) => (
                      <SelectItem key={dentist.id} value={dentist.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback
                              style={{ backgroundColor: dentist.color, color: "white" }}
                              className="text-xs"
                            >
                              {dentist.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <span>{dentist.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="treatment">Tratamiento</Label>
              <Select
                value={newAppointment.treatment}
                onValueChange={(value) => setNewAppointment({ ...newAppointment, treatment: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tratamiento" />
                </SelectTrigger>
                <SelectContent>
                  {treatmentTypes.map((treatment) => (
                    <SelectItem key={treatment.id} value={treatment.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: treatment.color }} />
                        <span>
                          {treatment.name} (${treatment.price})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Fecha</Label>
                <div className="flex">
                  <Input
                    id="date"
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Duración</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {formatTimeFromComponents(
                      newAppointment.customStartTime.hours,
                      newAppointment.customStartTime.minutes,
                    )}{" "}
                    -
                    {formatTimeFromComponents(newAppointment.customEndTime.hours, newAppointment.customEndTime.minutes)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Hora de inicio</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Clock className="mr-2 h-4 w-4" />
                        {formatTimeFromComponents(
                          newAppointment.customStartTime.hours,
                          newAppointment.customStartTime.minutes,
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-4 space-y-3">
                        <div className="space-y-1">
                          <Label>Horas</Label>
                          <Input
                            type="number"
                            min={businessHours.start}
                            max={businessHours.end - 1}
                            value={newAppointment.customStartTime.hours}
                            onChange={(e) =>
                              setNewAppointment({
                                ...newAppointment,
                                customStartTime: {
                                  ...newAppointment.customStartTime,
                                  hours: Number.parseInt(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Minutos</Label>
                          <Input
                            type="number"
                            min={0}
                            max={59}
                            step={5}
                            value={newAppointment.customStartTime.minutes}
                            onChange={(e) =>
                              setNewAppointment({
                                ...newAppointment,
                                customStartTime: {
                                  ...newAppointment.customStartTime,
                                  minutes: Number.parseInt(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="endTime">Hora de fin</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Clock className="mr-2 h-4 w-4" />
                        {formatTimeFromComponents(
                          newAppointment.customEndTime.hours,
                          newAppointment.customEndTime.minutes,
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-4 space-y-3">
                        <div className="space-y-1">
                          <Label>Horas</Label>
                          <Input
                            type="number"
                            min={businessHours.start}
                            max={businessHours.end}
                            value={newAppointment.customEndTime.hours}
                            onChange={(e) =>
                              setNewAppointment({
                                ...newAppointment,
                                customEndTime: {
                                  ...newAppointment.customEndTime,
                                  hours: Number.parseInt(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Minutos</Label>
                          <Input
                            type="number"
                            min={0}
                            max={59}
                            step={5}
                            value={newAppointment.customEndTime.minutes}
                            onChange={(e) =>
                              setNewAppointment({
                                ...newAppointment,
                                customEndTime: {
                                  ...newAppointment.customEndTime,
                                  minutes: Number.parseInt(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                placeholder="Añadir notas sobre esta cita"
                value={newAppointment.notes}
                onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewAppointmentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateAppointment}>Crear Cita</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Details Dialog */}
      <Dialog open={showAppointmentDetails} onOpenChange={setShowAppointmentDialog}>
        {selectedAppointment && (
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Detalles de la Cita</DialogTitle>
              <DialogDescription>
                {format(parseISO(selectedAppointment.startTime), "d 'de' MMMM, yyyy", { locale: es })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {selectedAppointment.patientName
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <h3 className="font-medium">{selectedAppointment.patientName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.patientId}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Tratamiento</h4>
                  <p>{selectedAppointment.treatment}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Importe</h4>
                  <p>{selectedAppointment.amount}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Hora de inicio</h4>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <p>{format(parseISO(selectedAppointment.startTime), "h:mm a")}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Hora de fin</h4>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <p>{format(parseISO(selectedAppointment.endTime), "h:mm a")}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Fecha</h4>
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p>{format(parseISO(selectedAppointment.startTime), "EEEE, d 'de' MMMM, yyyy", { locale: es })}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Dentista</h4>
                <p>{selectedAppointment.dentist}</p>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Notas</h4>
                  <p className="text-sm">{selectedAppointment.notes}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-muted-foreground">Estado</h4>
                <div className="mt-1">
                  {selectedAppointment.status === "confirmed" ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      Confirmado
                    </Badge>
                  ) : (
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                      Pendiente
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                onClick={() => handleDeleteAppointment(selectedAppointment.id)}
                className="sm:mr-auto"
              >
                Cancelar Cita
              </Button>
              <Button variant="outline">Editar</Button>
              <Button
                onClick={() => {
                  // Toggle status
                  const newStatus = selectedAppointment.status === "confirmed" ? "pending" : "confirmed"
                  const updatedAppointments = appointments.map((appt) =>
                    appt.id === selectedAppointment.id ? { ...appt, status: newStatus } : appt,
                  )
                  setAppointments(updatedAppointments)
                  setSelectedAppointment({ ...selectedAppointment, status: newStatus })
                }}
              >
                {selectedAppointment.status === "confirmed" ? "Marcar como Pendiente" : "Confirmar Cita"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
