export interface Patient {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    address?: string
    birth_date?: string
    gender?: string
    emergency_contact?: string
    emergency_phone?: string
    allergies?: string
    medications?: string
    medical_conditions?: string
    insurance_provider?: string
    policy_number?: string
    created_at?: string
}

export interface Doctor {
    id: string
    full_name: string
    role: string
    avatar_url?: string
}

export interface Appointment {
    id: string
    patient_id: string
    doctor_id?: string
    start_time: string
    end_time: string
    type: string
    status: 'pending' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed'
    notes?: string
    created_at?: string
    patients?: Patient
    profiles?: Doctor
}

export interface Treatment {
    id: string
    name: string
    price: number
    description?: string
}
