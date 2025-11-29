"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { User as SupabaseUser } from "@supabase/supabase-js"

interface User {
  id: string
  name: string
  email: string
  role: "doctor" | "reception"
  avatar: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ error: any }>
  signup: (email: string, password: string, fullName: string, role: "doctor" | "reception") => Promise<{ error: any }>
  signInWithGoogle: () => Promise<{ error: any }>
  logout: () => Promise<void>
  isLoading: boolean
  hasRole: (role: "doctor" | "reception") => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check active session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await fetchProfile(session.user)
      } else {
        setIsLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfile(session.user)
      } else {
        setUser(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (authUser: SupabaseUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle() // Use maybeSingle() instead of single() to avoid errors when profile doesn't exist

      if (error) {
        console.error('Error fetching profile:', error)
        // Create fallback user profile
        setUser({
          id: authUser.id,
          name: authUser.email?.split('@')[0] || 'User',
          email: authUser.email || '',
          role: 'doctor', // Default role
          avatar: '',
        })
      } else if (data) {
        // Profile exists, use it
        setUser({
          id: data.id,
          name: data.full_name || authUser.email?.split('@')[0],
          email: authUser.email || '',
          role: data.role || 'doctor',
          avatar: data.avatar_url || '',
        })
      } else {
        // Profile doesn't exist yet, create fallback
        console.log('Profile not found for user, using fallback data')
        setUser({
          id: authUser.id,
          name: authUser.email?.split('@')[0] || 'User',
          email: authUser.email || '',
          role: 'doctor', // Default role
          avatar: '',
        })
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error)
      // Create fallback user even on unexpected errors
      setUser({
        id: authUser.id,
        name: authUser.email?.split('@')[0] || 'User',
        email: authUser.email || '',
        role: 'doctor',
        avatar: '',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signup = async (email: string, password: string, fullName: string, role: "doctor" | "reception") => {
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

  const hasRole = (role: "doctor" | "reception"): boolean => {
    return user?.role === role
  }

  return <AuthContext.Provider value={{ user, login, signup, signInWithGoogle, logout, isLoading, hasRole }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
