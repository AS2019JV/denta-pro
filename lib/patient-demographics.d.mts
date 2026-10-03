import type { SupabaseClient } from "@supabase/supabase-js"
export type DemographicField = 'first_name'|'last_name'|'cedula'|'email'|'phone'|'birth_date'|'gender'|'address'|'city'|'state'|'occupation'|'medical_record_number'|'emergency_contact'|'emergency_phone'|'marital_status'|'status'|'preferred_contact_method'
export type DemographicForm = Record<DemographicField,string>
export type DemographicPatient = {id:string;clinic_id:string} & Record<DemographicField,string|null>
export const DEMOGRAPHIC_FIELDS: readonly DemographicField[]
export function demographicForm(patient?: DemographicPatient | null): DemographicForm
export function demographicPayload(form: DemographicForm,today?:Date): Record<DemographicField,string|null>
export function projectDemographic(record:unknown,clinicId:string): DemographicPatient
export function parseDemographicPage(data:unknown,clinicId:string,limit:number): {items:DemographicPatient[];total_count:number}
export function loadDemographicPage(client:Pick<SupabaseClient,"rpc">,clinicId:string,search:string,page:number,limit:number,signal:AbortSignal):Promise<{items:DemographicPatient[];total_count:number}|undefined>
export function saveDemographic(client:Pick<SupabaseClient,"rpc">,clinicId:string,form:DemographicForm,patientId:string|null,signal:AbortSignal):Promise<DemographicPatient|undefined>
export function demographicSaveError(error:unknown):string

