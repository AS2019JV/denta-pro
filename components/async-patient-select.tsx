"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
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
  const { currentClinicId, user, isLoading: authLoading, authError } = useAuth()
  const scope = `${currentClinicId || ''}:${user?.id || ''}:${user?.role || ''}`
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedName, setSelectedName] = useState("")
  const [searchError, setSearchError] = useState(false)
  const searchController = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const previousScope = useRef(scope)
  const selectionCallback = useRef(onValueChange)
  selectionCallback.current = onValueChange

  useEffect(() => {
    if (previousScope.current !== scope) {
      previousScope.current = scope
      selectionCallback.current("")
    }
    requestId.current += 1
    searchController.current?.abort()
    setPatients([])
    setSearch("")
    setSelectedName("")
    setLoading(false)
    setSearchError(false)
    setOpen(false)
    return () => { requestId.current += 1; searchController.current?.abort() }
  }, [scope])

  useEffect(() => {
    if (!value) setSelectedName("")
  }, [value])

  const fetchPatients = useCallback(async (searchTerm: string) => {
    const request = ++requestId.current
    searchController.current?.abort()
    setSearchError(false)
    if (!searchTerm || searchTerm.length < 2) {
      setPatients([])
      setLoading(false)
      return
    }

    if (!currentClinicId || !user?.id || authLoading || authError) {
      setPatients([])
      setLoading(false)
      return
    }

    setLoading(true)
    setPatients([])
    const controller = new AbortController()
    searchController.current = controller
    try {
      const { data, error } = await supabase.rpc('get_patient_demographics', {
        p_clinic_id: currentClinicId, p_search: searchTerm.trim(), p_limit: 5, p_offset: 0, p_patient_id: null,
      }).abortSignal(controller.signal)

      if (error) throw error
      if (!data || !Array.isArray(data.items) || data.items.some((item: Patient) => !item || typeof item.id !== 'string' || typeof item.first_name !== 'string' || typeof item.last_name !== 'string') || !Number.isSafeInteger(data.total_count) || data.total_count < data.items.length) throw new Error('Respuesta inválida')
      if (request === requestId.current) setPatients(data.items)
    } catch {
      if (request === requestId.current) { setPatients([]); setSearchError(true) }
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [currentClinicId, user?.id, user?.role, authLoading, authError])

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
          disabled={authLoading || !!authError || !currentClinicId || !user?.id}
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
              aria-label="Buscar pacientes por nombre o teléfono"
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Escribe nombre o teléfono..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <ScrollArea className="max-h-[300px] overflow-y-auto">
            <div className="p-1" role="listbox" aria-label="Pacientes encontrados">
              {loading && <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>}
              {!loading && searchError && <div role="alert" className="p-4 text-center text-sm">No se pudo buscar pacientes. Reintenta la búsqueda.</div>}
              {!loading && !searchError && patients.length === 0 && search.length >= 2 && (
                <div className="p-4 text-center text-sm text-muted-foreground">No se encontraron pacientes.</div>
              )}
              {!loading && search.length < 2 && (
                <div className="p-4 text-center text-sm text-muted-foreground">Escribe al menos 2 caracteres...</div>
              )}
              {patients.map((patient) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === patient.id}
                  key={patient.id}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
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
                </button>
              ))}
            </div>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
