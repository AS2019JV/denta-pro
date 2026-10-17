'use client'
import { AppointmentEditor } from '@/components/appointment-editor'
import { useAuth } from '@/components/auth-context'
interface Props {
  patientId: string
  patientName: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}
export function QuickAppointmentDialog({
  patientId,
  patientName,
  isOpen,
  onOpenChange,
  onSuccess,
}: Props) {
  const { user, currentClinicId } = useAuth()
  if (!isOpen) return null
  return (
    <AppointmentEditor
      key={`${currentClinicId}:${user?.id}:${user?.role}:${patientId}`}
      open
      patientId={patientId}
      patientName={patientName}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  )
}
