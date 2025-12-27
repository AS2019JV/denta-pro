export type AppRole = 'clinic_owner' | 'doctor' | 'receptionist';
export type UserStatus = 'invited' | 'active' | 'suspended';

export interface UserProfile {
  id: string;
  clinic_id: string;
  role: AppRole;
  full_name: string;
  email: string;
}
