"use client"

import { useState, useRef, useEffect } from "react"
import { format, addHours, parseISO, startOfDay, isSameDay } from "date-fns"
import { Clock, Plus, X, Calendar } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Sample appointment data
const initialAppointments = [
  {
    id: "1",
    patientName: "Sarah Johnson",
    startTime: "2025-03-26T09:00:00",
    endTime: "2025-03-26T10:00:00",
    treatment: "Cleaning",
    amount: "$120",
    color: "#007BFF",
    patientInfo: {
      phone: "(555) 123-4567",
      email: "sarah.j@example.com",
      address: "123 Main St, Anytown",
      code: "PT-10045",
      treatmentDetails: "Regular cleaning and checkup",
    },
  },
  {
    id: "2",
    patientName: "Michael Chen",
    startTime: "2025-03-26T11:30:00",
    endTime: "2025-03-26T13:00:00",
    treatment: "Root Canal",
    amount: "$850",
    color: "#28A745",
    patientInfo: {
      phone: "(555) 987-6543",
      email: "m.chen@example.com",
      address: "456 Oak Ave, Somewhere",
      code: "PT-10046",
      treatmentDetails: "Root canal treatment for upper right molar",
    },
  },
  {
    id: "3",
    patientName: "Emily Rodriguez",
    startTime: "2025-03-26T14:00:00",
    endTime: "2025-03-26T15:00:00",
    treatment: "Consultation",
    amount: "$75",
    color: "#2D9CDB",
    patientInfo: {
      phone: "(555) 456-7890",
      email: "emily.r@example.com",
      address: "789 Pine St, Elsewhere",
      code: "PT-10047",
      treatmentDetails: "Initial consultation for orthodontic treatment",
    },
  },
]

// Business hours
const businessHours = {
  start: 8, // 8 AM
  end: 18, // 6 PM
}

export function AppointmentTimeline() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState(initialAppointments)
  const [selectedAppointment, setSelectedAppointment] = useState<(typeof appointments)[0] | null>(null)
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false)
  const [showNewAppointmentDialog, setShowNewAppointmentDialog] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const timelineRef = useRef<HTMLDivElement>(null)
  const [newAppointment, setNewAppointment] = useState({
    patientName: "",
    treatment: "Cleaning",
    amount: "",
    startHour: 9,
    endHour: 10,
  })

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Handle click on timeline to create appointment
  const handleTimeSlotClick = (hour: number) => {
    setNewAppointment({
      ...newAppointment,
      startHour: hour,
      endHour: hour + 1, // Default to 1 hour appointment
    })
    setShowNewAppointmentDialog(true)
  }

  // Create a new appointment
  const createAppointment = () => {
    if (newAppointment.patientName && newAppointment.amount) {
      const startDate = startOfDay(currentDate)
      const startTime = addHours(startDate, newAppointment.startHour).toISOString()
      const endTime = addHours(startDate, newAppointment.endHour).toISOString()

      const newAppt = {
        id: `temp-${Date.now()}`,
        patientName: newAppointment.patientName,
        startTime,
        endTime,
        treatment: newAppointment.treatment,
        amount: `$${newAppointment.amount}`,
        color: "#007BFF", // Using primary color for consistency
        patientInfo: {
          phone: "(555) 000-0000", // Default placeholder
          email: `${newAppointment.patientName.toLowerCase().replace(/\s/g, ".")}@example.com`, // Generated email
          address: "123 Dental St, Suite 100", // Default placeholder
          code: `PT-${Math.floor(10000 + Math.random() * 90000)}`,
          treatmentDetails: `${newAppointment.treatment} appointment for ${newAppointment.patientName}`,
        },
      }

      setAppointments([...appointments, newAppt])
      setShowNewAppointmentDialog(false)
      setNewAppointment({
        patientName: "",
        treatment: "Cleaning",
        amount: "",
        startHour: 9,
        endHour: 10,
      })
    }
  }

  // Delete an appointment
  const deleteAppointment = (id: string) => {
    setAppointments(appointments.filter((appt) => appt.id !== id))
    setShowAppointmentDetails(false)
  }

  // Calculate current time progress percentage
  const getCurrentTimeProgress = () => {
    const now = new Date()
    const totalMinutes = (businessHours.end - businessHours.start) * 60
    const currentMinutes = (now.getHours() - businessHours.start) * 60 + now.getMinutes()

    if (currentMinutes < 0) return 0
    if (currentMinutes > totalMinutes) return 100

    return (currentMinutes / totalMinutes) * 100
  }

  // Filter appointments for the current date
  const todaysAppointments = appointments.filter((appt) => isSameDay(parseISO(appt.startTime), currentDate))

  // Calculate appointment position and width
  const getAppointmentStyle = (appt: (typeof appointments)[0]) => {
    const startHour = parseISO(appt.startTime).getHours() + parseISO(appt.startTime).getMinutes() / 60
    const endHour = parseISO(appt.endTime).getHours() + parseISO(appt.endTime).getMinutes() / 60

    const totalHours = businessHours.end - businessHours.start
    const startPercent = ((startHour - businessHours.start) / totalHours) * 100
    const widthPercent = ((endHour - startHour) / totalHours) * 100

    return {
      left: `${startPercent}%`,
      width: `${widthPercent}%`,
    }
  }

  // Handle appointment click
  const handleAppointmentClick = (appt: (typeof appointments)[0]) => {
    setSelectedAppointment(appt)
    setShowAppointmentDetails(true)
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-none shadow-sm max-w-3xl mx-auto">
        {/* Progress bar */}
        {isSameDay(currentDate, new Date()) && (
          <div className="relative h-1 bg-gray-100 dark:bg-gray-800">
            <div
              className="absolute h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${getCurrentTimeProgress()}%` }}
            />
          </div>
        )}

        {/* Timeline header - hours */}
        <div className="flex border-b">
          {Array.from({ length: businessHours.end - businessHours.start }).map((_, index) => {
            const hour = businessHours.start + index
            return (
              <div key={hour} className="flex-1 py-1 pl-1 text-[10px] font-medium text-muted-foreground">
                {format(addHours(new Date().setHours(0, 0, 0, 0), hour), "ha")}
              </div>
            )
          })}
        </div>

        {/* Timeline content */}
        <div ref={timelineRef} className="relative h-16">
          {/* Hour cells for interaction */}
          <div className="absolute inset-0 flex h-full">
            {Array.from({ length: businessHours.end - businessHours.start }).map((_, index) => {
              const hour = businessHours.start + index
              return (
                <div
                  key={hour}
                  className="flex-1 border-r cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handleTimeSlotClick(hour)}
                />
              )
            })}
          </div>

          {/* Current time indicator */}
          {isSameDay(currentDate, new Date()) && (
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
              style={{
                left: `${((currentTime.getHours() - businessHours.start + currentTime.getMinutes() / 60) / (businessHours.end - businessHours.start)) * 100}%`,
              }}
            >
              <div className="absolute -top-1 -translate-x-1/2 h-2 w-2 rounded-full bg-red-500" />
            </div>
          )}

          {/* Appointments */}
          <div className="absolute inset-0">
            <TooltipProvider>
              {todaysAppointments.map((appt) => {
                const style = getAppointmentStyle(appt)
                const startTime = format(parseISO(appt.startTime), "h:mm a")

                return (
                  <Tooltip key={appt.id}>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute top-1 h-[calc(100%-8px)] rounded-md shadow-sm cursor-pointer transition-all hover:shadow-md hover:brightness-95 dark:hover:brightness-110 bg-primary"
                        style={style}
                        onClick={() => handleAppointmentClick(appt)}
                      >
                        <div className="flex h-full flex-col justify-center p-1 text-white">
                          <div className="truncate text-xs font-medium">{appt.patientName}</div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{appt.patientName}</p>
                      <p className="text-xs">
                        {startTime} • {appt.treatment}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </TooltipProvider>
          </div>
        </div>
      </Card>

      {/* Appointment Details Dialog */}
      <Dialog open={showAppointmentDetails} onOpenChange={setShowAppointmentDetails}>
        {selectedAppointment && (
          <DialogContent className="sm:max-w-[500px] p-0">
            <div className="p-6 pb-2">
              <DialogHeader>
                <DialogTitle>{selectedAppointment.patientName}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Clock className="h-3.5 w-3.5" />
                  {format(parseISO(selectedAppointment.startTime), "h:mm a")} -{" "}
                  {format(parseISO(selectedAppointment.endTime), "h:mm a")}
                  <span className="mx-1">•</span>
                  <Calendar className="h-3.5 w-3.5" />
                  {format(parseISO(selectedAppointment.startTime), "MMMM d, yyyy")}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 py-2">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-primary">{selectedAppointment.treatment}</Badge>
                <span className="font-semibold">{selectedAppointment.amount}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1">Patient Information</h4>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div className="text-muted-foreground">Patient ID</div>
                    <div>{selectedAppointment.patientInfo.code}</div>
                    <div className="text-muted-foreground">Phone</div>
                    <div>{selectedAppointment.patientInfo.phone}</div>
                    <div className="text-muted-foreground">Email</div>
                    <div>{selectedAppointment.patientInfo.email}</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-1">Treatment Details</h4>
                  <p className="text-sm">{selectedAppointment.patientInfo.treatmentDetails}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-1">Address</h4>
                  <p className="text-sm">{selectedAppointment.patientInfo.address}</p>
                </div>
              </div>
            </div>

            <div className="flex border-t mt-4">
              <Button
                variant="ghost"
                className="flex-1 rounded-none text-destructive hover:text-destructive"
                onClick={() => deleteAppointment(selectedAppointment.id)}
              >
                Cancel Appointment
              </Button>
              <Button variant="ghost" className="flex-1 rounded-none">
                <X className="mr-2 h-4 w-4" />
                Mark as Missed
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* New Appointment Dialog */}
      <Dialog open={showNewAppointmentDialog} onOpenChange={setShowNewAppointmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
            <DialogDescription>
              {format(currentDate, "MMMM d, yyyy")} •{" "}
              {format(addHours(startOfDay(new Date()), newAppointment.startHour), "h:mm a")} -{" "}
              {format(addHours(startOfDay(new Date()), newAppointment.endHour), "h:mm a")}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="client">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="client">Client</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="client" className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="patientName">Patient Name</Label>
                  <Input
                    id="patientName"
                    value={newAppointment.patientName}
                    onChange={(e) => setNewAppointment({ ...newAppointment, patientName: e.target.value })}
                    placeholder="Enter patient name"
                  />
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="mt-7">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>New Patient</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="newName" className="text-right">
                          Name
                        </Label>
                        <Input id="newName" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="newPhone" className="text-right">
                          Phone
                        </Label>
                        <Input id="newPhone" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="newEmail" className="text-right">
                          Email
                        </Label>
                        <Input id="newEmail" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="newAddress" className="text-right">
                          Address
                        </Label>
                        <Input id="newAddress" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="newCode" className="text-right">
                          Patient ID
                        </Label>
                        <div className="col-span-3 flex items-center gap-2">
                          <Input id="newCode" value={`PT-${Math.floor(10000 + Math.random() * 90000)}`} disabled />
                          <span className="text-xs text-muted-foreground">(Auto-generated)</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="newTreatment" className="text-right">
                          Treatment
                        </Label>
                        <div className="col-span-3">
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge className="cursor-pointer">Cleaning</Badge>
                            <Badge className="cursor-pointer">Consultation</Badge>
                            <Badge className="cursor-pointer">Root Canal</Badge>
                            <Badge className="cursor-pointer">Filling</Badge>
                            <Badge variant="outline" className="cursor-pointer">
                              + Custom
                            </Badge>
                          </div>
                          <Textarea id="newTreatment" placeholder="Treatment details..." />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Documents</Label>
                        <div className="col-span-3">
                          <div className="border-2 border-dashed rounded-md p-6 text-center">
                            <p className="text-sm text-muted-foreground">Drag & drop files here or click to browse</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline">Advance</Button>
                      <Button>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="treatment">Treatment</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    className={cn("cursor-pointer", newAppointment.treatment === "Cleaning" && "bg-primary")}
                    onClick={() => setNewAppointment({ ...newAppointment, treatment: "Cleaning" })}
                  >
                    Cleaning
                  </Badge>
                  <Badge
                    className={cn("cursor-pointer", newAppointment.treatment === "Consultation" && "bg-primary")}
                    onClick={() => setNewAppointment({ ...newAppointment, treatment: "Consultation" })}
                  >
                    Consultation
                  </Badge>
                  <Badge
                    className={cn("cursor-pointer", newAppointment.treatment === "Root Canal" && "bg-primary")}
                    onClick={() => setNewAppointment({ ...newAppointment, treatment: "Root Canal" })}
                  >
                    Root Canal
                  </Badge>
                  <Badge
                    className={cn("cursor-pointer", newAppointment.treatment === "Filling" && "bg-primary")}
                    onClick={() => setNewAppointment({ ...newAppointment, treatment: "Filling" })}
                  >
                    Filling
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  value={newAppointment.amount}
                  onChange={(e) => setNewAppointment({ ...newAppointment, amount: e.target.value })}
                  placeholder="Enter amount"
                  type="number"
                />
              </div>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 pt-4">
              <div className="grid gap-2">
                <Label htmlFor="objective">Objective</Label>
                <Input id="objective" placeholder="Enter activity objective" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Enter activity description" />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewAppointmentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createAppointment}>Book Appointment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
