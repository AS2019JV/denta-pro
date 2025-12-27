
import { es } from 'date-fns/locale'

export const APP_CONFIG = {
  locale: es,
  localeStr: 'es-EC',
  timezone: 'America/Guayaquil', // Equator/Quito
  currency: 'USD',
}

export const ROLES = {
  CLINIC_OWNER: 'clinic_owner',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist',
}

export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
}
