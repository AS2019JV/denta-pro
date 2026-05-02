"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { toast } from "sonner"

interface ClinicMembership {
  clinic_id: string
  role: "doctor" | "receptionist" | "clinic_owner"
  clinics?: {
    name: string
    size?: string
    settings?: any
  }
}

interface User {
  id: string
  name: string
  email: string
  role: "doctor" | "receptionist" | "clinic_owner"
  avatar: string
  phone?: string
  bio?: string
  clinic_id?: string
  clinic_memberships?: ClinicMembership[]
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ error: any }>
  signup: (email: string, password: string, fullName: string, role: "doctor" | "receptionist" | "clinic_owner") => Promise<{ error: any }>
  resetPassword: (email: string) => Promise<{ error: any }>
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
        // Force redirect to dashboard if we have a user
        // This handles cases where login modal might just close or state updates without navigation
        // But we should check if we are already there to avoid redundant pushes
        if (window.location.pathname === '/login' || window.location.pathname === '/' || window.location.pathname === '/free-trial') {
            // router.push("/dashboard") // router is not available here easily without wrapping or passing it in.
            // But we can check window location and rely on the useEffect dependency below or add a navigation trigger
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
        .maybeSingle()

      const metaName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario'
      const metaRole = authUser.user_metadata?.role || 'clinic_owner'

      if (error) {
        console.error('Error fetching profile:', JSON.stringify(error, null, 2))
        setUser({
          id: authUser.id,
          name: metaName,
          email: authUser.email || '',
          role: metaRole as any,
          avatar: '',
          clinic_id: undefined
        })
      } else if (data) {
        const { data: memberships } = await supabase
            .from('clinic_members')
            .select('clinic_id, role, clinics(name, size, settings)')
            .eq('user_id', authUser.id)
        
        const clinicMemberships = (memberships || []).map((m: any) => ({
            clinic_id: m.clinic_id,
            role: m.role,
            clinics: Array.isArray(m.clinics) ? m.clinics[0] : m.clinics
        })) as ClinicMembership[]
        
        const defaultClinicId = data.clinic_id || (clinicMemberships.length > 0 ? clinicMemberships[0].clinic_id : undefined)
        
        setCurrentClinicId(defaultClinicId)

        setUser({
          id: data.id,
          name: data.full_name || metaName,
          email: authUser.email || '',
          role: (data.role || metaRole) as any,
          avatar: data.avatar_url || '',
          phone: data.phone || '',
          bio: data.bio || '',
          clinic_id: data.clinic_id,
          clinic_memberships: clinicMemberships
        })
      } else {
        setUser({
          id: authUser.id,
          name: metaName,
          email: authUser.email || '',
          role: metaRole as any,
          avatar: '',
          clinic_id: undefined
        })
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error)
      setUser({
        id: authUser.id,
        name: authUser.user_metadata?.full_name || 'Usuario',
        email: authUser.email || '',
        role: (authUser.user_metadata?.role || 'clinic_owner') as any,
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
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: fullName,
          role: role,
        },
      },
    })
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
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

  return <AuthContext.Provider value={{ user, login, signup, resetPassword, signInWithGoogle, logout, isLoading, hasRole, currentClinicId, switchClinic }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
