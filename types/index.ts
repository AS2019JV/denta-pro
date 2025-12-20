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
    status: 'pending' | 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'scheduled' | 'no_show'
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

export interface Billing {
    id: string
    patient_id: string
    appointment_id?: string
    amount: number
    status: 'pending' | 'paid' | 'cancelled' | 'overdue'
    description?: string
    created_at: string
    invoice_number?: string
    due_date?: string
    
    // Relations
    invoices?: Invoice[]
    payments?: Payment[]
    patients?: Patient
}

export interface Invoice {
    id: string
    billing_id: string
    invoice_number: string
    sri_access_key?: string
    sri_authorization_date?: string
    xml_content?: string
    status: 'DRAFT' | 'GENERATED' | 'SIGNED' | 'AUTHORIZED' | 'REJECTED'
    pdf_url?: string
    environment?: 'TEST' | 'PRODUCTION'
    created_at: string
}

export interface Payment {
    id: string
    billing_id: string
    amount: number
    method: 'CASH' | 'TRANSFER' | 'STRIPE' | 'PAYPHONE' | 'OTHER'
    reference?: string
    proof_url?: string
    status: 'pending' | 'completed' | 'failed'
    created_at: string
}

export interface PaymentMethod {
    id: string
    doctor_id?: string
    type: 'BANK_TRANSFER' | 'STRIPE' | 'PAYPHONE'
    title: string
    config: any // { account_number, bank_name... }
    is_active: boolean
}
