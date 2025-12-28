"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { toast } from "sonner"

interface User {
  id: string
  name: string
  email: string
  role: "doctor" | "receptionist" | "clinic_owner"
  avatar: string
  clinic_id?: string
  clinic_memberships?: any[]
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ error: any }>
  signup: (email: string, password: string, fullName: string, role: "doctor" | "receptionist" | "clinic_owner") => Promise<{ error: any }>
  signInWithGoogle: () => Promise<{ error: any }>
  logout: () => Promise<void>
  isLoading: boolean
  hasRole: (role: "doctor" | "receptionist" | "clinic_owner") => boolean
  currentClinicId: string | undefined
  switchClinic: (clinicId: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [currentClinicId, setCurrentClinicId] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check active session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          throw error
        }
        if (session?.user) {
          await fetchProfile(session.user)
        } else {
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error checking session:", error)
        setIsLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event);
      
      if (session?.user) {
        // Only fetch profile if not already loaded or user changed
        if (!user || user.id !== session.user.id) {
             await fetchProfile(session.user)
        }
      } else {
        // Signed out or no session
        setUser(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // Keep empty array to run once on mount. Logic handles internal state check.

  const fetchProfile = async (authUser: SupabaseUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle() // Use maybeSingle() instead of single() to avoid errors when profile doesn't exist

      if (error) {
        console.error('Error fetching profile:', JSON.stringify(error, null, 2))
        // Create fallback user profile
        setUser({
          id: authUser.id,
          name: authUser.email?.split('@')[0] || 'User',
          email: authUser.email || '',
          role: 'doctor', // Default role
          avatar: '',
          clinic_id: undefined
        })
      } else if (data) {
        // Fetch memberships
        const { data: memberships } = await supabase
            .from('clinic_members')
            .select('clinic_id, role, clinics(name)')
            .eq('user_id', authUser.id)
        
        const clinicMemberships = memberships || []
        // Use profile clinic_id as default, or first membership
        const defaultClinicId = data.clinic_id || (clinicMemberships.length > 0 ? clinicMemberships[0].clinic_id : undefined)
        
        setCurrentClinicId(defaultClinicId)

        // Profile exists, use it
        setUser({
          id: data.id,
          name: data.full_name || authUser.email?.split('@')[0],
          email: authUser.email || '',
          role: data.role || 'doctor',
          avatar: data.avatar_url || '',
          clinic_id: data.clinic_id,
          clinic_memberships: clinicMemberships
        })
      } else {
        // Profile doesn't exist yet -> Valid "Limbo" State for Onboarding
        console.log('User has no profile (Limbo State) - waiting for clinic creation.');
        setUser({
          id: authUser.id,
          name: authUser.email?.split('@')[0] || 'Nuevo Usuario',
          email: authUser.email || '',
          role: 'clinic_owner', // Default permission level for setup
          avatar: '',
          clinic_id: undefined // Explicitly undefined triggers Onboarding redirect
        })
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error)
      // Create fallback user even on unexpected errors
      setUser({
        id: authUser.id,
        name: authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        role: 'clinic_owner',
        avatar: '',
        clinic_id: undefined
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  const switchClinic = (clinicId: string) => {
    // Verify membership locally
    if (user?.clinic_memberships?.some(m => m.clinic_id === clinicId) || user?.clinic_id === clinicId) {
        setCurrentClinicId(clinicId)
        toast.success("Cambiado a clínica activa")
    }
  }

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signup = async (email: string, password: string, fullName: string, role: "doctor" | "receptionist" | "clinic_owner") => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
      },
    })
    return { error }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    return { error }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const hasRole = (role: "doctor" | "receptionist" | "clinic_owner"): boolean => {
    return user?.role === role
  }

  return <AuthContext.Provider value={{ user, login, signup, signInWithGoogle, logout, isLoading, hasRole, currentClinicId, switchClinic }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
