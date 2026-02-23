"use client"

import { useState, useCallback } from "react"
import { Check, ChevronsUpDown, Search, UserPlus } from "lucide-react"
import { Command } from "cmdk"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Patient {
  id: string
  first_name: string
  last_name: string
  phone?: string
}

interface AsyncPatientSelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
}

export function AsyncPatientSelect({ value, onValueChange, placeholder = "Buscar paciente..." }: AsyncPatientSelectProps) {
  const { currentClinicId } = useAuth()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedName, setSelectedName] = useState("")

  const fetchPatients = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setPatients([])
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, phone')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .eq('clinic_id', currentClinicId)
        .limit(5)

      if (error) throw error
      setPatients(data || [])
    } catch (err) {
      console.error("Error searching patients:", err)
    } finally {
      setLoading(false)
    }
  }, [currentClinicId])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    fetchPatients(val)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedName || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command label="Buscar paciente" shouldFilter={false} className="flex flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Escribe nombre o teléfono..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <ScrollArea className="max-h-[300px] overflow-y-auto">
            <div className="p-1">
              {loading && <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>}
              {!loading && patients.length === 0 && search.length >= 2 && (
                <div className="p-4 text-center text-sm text-muted-foreground">No se encontraron pacientes.</div>
              )}
              {!loading && search.length < 2 && (
                <div className="p-4 text-center text-sm text-muted-foreground">Escribe al menos 2 caracteres...</div>
              )}
              {patients.map((patient) => (
                <div
                  key={patient.id}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                    value === patient.id && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => {
                    onValueChange(patient.id)
                    setSelectedName(`${patient.first_name} ${patient.last_name}`)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === patient.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{patient.first_name} {patient.last_name}</span>
                    {patient.phone && <span className="text-xs text-muted-foreground">{patient.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
