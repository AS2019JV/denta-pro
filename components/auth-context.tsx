"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { QueryClientContext } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { toast } from "sonner"
import { CLINIC_PREFERENCE_COOKIE, CLINIC_ROLES, selectClinicMembership } from "@/lib/clinic-authority.mjs"

interface ClinicMembership {
  clinic_id: string
  status: string
  role: "doctor" | "receptionist" | "clinic_owner"
  clinics?: {
    name: string
    size?: string
    settings?: any
    logo_url?: string
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
  title?: string
  clinic_id?: string
  clinic_memberships?: ClinicMembership[]
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ error: any; requiresMfa: boolean }>
  signup: (email: string, password: string, fullName: string, role: "doctor" | "receptionist" | "clinic_owner") => Promise<{ error: any }>
  resetPassword: (email: string) => Promise<{ error: any }>
  signInWithGoogle: () => Promise<{ error: any }>
  logout: () => Promise<void>
  isLoading: boolean
  isRevalidating: boolean
  hasRole: (role: "doctor" | "receptionist" | "clinic_owner") => boolean
  currentClinicId: string | undefined
  switchClinic: (clinicId: string) => void
  refreshProfile: () => Promise<void>
  authError: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [currentClinicId, setCurrentClinicId] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [isRevalidating, setIsRevalidating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const queryClient = useContext(QueryClientContext)
  const generation = useRef(0)
  const mounted = useRef(true)
  const selectedClinic = useRef<string | undefined>(undefined)
  const verifiedScope = useRef<string | undefined>(undefined)
  const identity = useRef<string | undefined>(undefined)
  const refreshing = useRef(false)
  const refreshJob = useRef(0)
  const loggingOut = useRef(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clearAuthority = useCallback(() => {
    verifiedScope.current = undefined
    setIsRevalidating(false)
    setUser(null)
    setCurrentClinicId(undefined)
    void queryClient?.cancelQueries()
    queryClient?.clear()
  }, [queryClient])

  const fetchProfile = useCallback(async (authUser: SupabaseUser, preferredClinic?: string, preserveScope = false) => {
    const ticket = ++generation.current
    // Same-scope revalidation hides/inerts mounted consumers in DashboardWrapper,
    // preserving drafts. Identity/clinic changes still invalidate immediately.
    if (!preserveScope) {
      setUser(null)
      setCurrentClinicId(undefined)
      setIsLoading(true)
    }
    setAuthError(null)
    const current = () => mounted.current && !loggingOut.current && ticket === generation.current
    try {
      const [profileResult, membershipResult] = await Promise.all([
        supabase.from('profiles').select('id,full_name,avatar_url,phone,bio,title,clinic_id,status,deleted_at').eq('id', authUser.id).maybeSingle(),
        supabase.from('clinic_members').select('clinic_id,role,status,clinics(name,size,settings,logo_url)').eq('user_id', authUser.id).eq('status', 'active'),
      ])
      const { data: profile, error: profileError } = profileResult
      if (profileError) throw profileError
      const { data: memberships, error: membershipError } = membershipResult
      if (membershipError) throw membershipError
      const cookie = document.cookie.split('; ').find(c => c.startsWith(`${CLINIC_PREFERENCE_COOKIE}=`))?.split('=')[1]
      const selection = selectClinicMembership(profile, memberships || [], preferredClinic ?? selectedClinic.current ?? cookie)
      if (!selection || !profile) {
        if (current()) { clearAuthority(); setAuthError('Tu cuenta no tiene acceso activo a una clínica. Contacta al administrador.') }
        return
      }
      const {data: liveRole, error: roleError} = await supabase.rpc('get_clinic_member_role', {check_clinic_id: selection.clinic_id})
      if (roleError) throw roleError
      if (!CLINIC_ROLES.includes(liveRole) || liveRole !== selection.role) {
        if (current()) { clearAuthority(); setAuthError('Tus permisos han cambiado. Vuelve a verificar el acceso.') }
        return
      }
      if (!current()) return
      const nextScope = `${authUser.id}:${selection.clinic_id}:${liveRole}`
      if (verifiedScope.current !== nextScope) {
        void queryClient?.cancelQueries()
        queryClient?.clear()
      }
      verifiedScope.current = nextScope
      const clinicMemberships = (memberships || []).filter(m => CLINIC_ROLES.includes(m.role)).map(m => ({
        ...m, clinics: Array.isArray(m.clinics) ? m.clinics[0] : m.clinics
      })) as ClinicMembership[]
      selectedClinic.current = selection.clinic_id
      document.cookie = `${CLINIC_PREFERENCE_COOKIE}=${selection.clinic_id}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
      setCurrentClinicId(selection.clinic_id)
      setUser({id: profile.id, name: profile.full_name || 'Usuario', email: authUser.email || '',
        role: liveRole, avatar: profile.avatar_url || '', phone: profile.phone || '', bio: profile.bio || '',
        title: profile.title || '', clinic_id: selection.clinic_id, clinic_memberships: clinicMemberships})
    } catch {
      if (current()) { clearAuthority(); setAuthError('No se pudo verificar tu acceso. Reintenta cuando tengas conexión.') }
    } finally {
      if (current()) { setIsLoading(false); setIsRevalidating(false) }
    }
  }, [clearAuthority, queryClient])

  const refreshProfile = useCallback(async (preserveScope = false) => {
    if (loggingOut.current) return
    // Network-verified identity; cached session metadata is not authority.
    const ticket = ++generation.current
    const keepScope = preserveScope && !!verifiedScope.current
    if (keepScope) setIsRevalidating(true)
    else {
      setUser(null)
      setCurrentClinicId(undefined)
      setIsLoading(true)
    }
    setAuthError(null)
    try {
      // Never issue profile or membership reads at AAL1. RLS independently
      // enforces this, but deferring here keeps auth and recovery flows usable.
      const claimsResult = await supabase.auth.getClaims()
      if (claimsResult.error || !claimsResult.data?.claims.sub || claimsResult.data.claims.role !== 'authenticated') {
        if (mounted.current && ticket === generation.current) {
          clearAuthority()
          setAuthError(null)
          setIsLoading(false)
          setIsRevalidating(false)
        }
        return
      }
      const [assuranceResult, factorsResult] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])
      const hasVerifiedTotp = factorsResult.data?.totp?.some(factor => factor.status === 'verified') === true
      const hasMfaAuthority = !claimsResult.error && claimsResult.data?.claims.aal === 'aal2'
        && assuranceResult.data?.currentLevel === 'aal2' && assuranceResult.data?.nextLevel === 'aal2'
        && !factorsResult.error && hasVerifiedTotp
      if (!hasMfaAuthority) {
        if (mounted.current && ticket === generation.current) {
          clearAuthority()
          setAuthError(null)
          setIsLoading(false)
          setIsRevalidating(false)
        }
        return
      }
      const {data: {user: authUser}, error} = await supabase.auth.getUser()
      if (!mounted.current || ticket !== generation.current) return
      if (error || !authUser) {
        clearAuthority()
        setIsLoading(false)
        return
      }
      const sameIdentity = identity.current === authUser.id
      if (!sameIdentity) clearAuthority()
      identity.current = authUser.id
      await fetchProfile(authUser, undefined, keepScope && sameIdentity)
    } catch {
      if (mounted.current && ticket === generation.current) {
        clearAuthority()
        setAuthError('No se pudo verificar tu sesión. Reintenta cuando tengas conexión.')
        setIsLoading(false)
      }
    }
  }, [clearAuthority, fetchProfile])

  useEffect(() => {
    mounted.current = true
    const schedule = (actorId?: string, force = false) => {
      if (loggingOut.current) return
      if (!force && refreshing.current && (!actorId || actorId === identity.current)) return
      if (actorId && actorId !== identity.current) {
        clearAuthority()
        identity.current = actorId
      }
      // Invalidate in this event turn, before an old promise can publish scope.
      ++generation.current
      const keepScope = !force && !!verifiedScope.current && (!actorId || actorId === identity.current)
      if (keepScope) setIsRevalidating(true)
      else {
        setUser(null)
        setCurrentClinicId(undefined)
        setIsLoading(true)
      }
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        if (loggingOut.current) return
        refreshing.current = true
        const job = ++refreshJob.current
        void refreshProfile(keepScope).finally(() => { if (job === refreshJob.current) refreshing.current = false })
      }, 0)
    }
    // Keep this callback synchronous: Supabase holds its Auth lock here.
    const {data: {subscription}} = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearTimeout(refreshTimer.current)
        ++generation.current
        selectedClinic.current = undefined
        identity.current = undefined
        refreshing.current = false
        ++refreshJob.current
        document.cookie = `${CLINIC_PREFERENCE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
        clearAuthority()
        setAuthError(null)
        setIsLoading(false)
      } else schedule(session?.user.id, event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY')
    })
    schedule()
    const onFocus = () => schedule()
    const onVisible = () => { if (document.visibilityState === 'visible') schedule() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted.current = false
      ++generation.current
      clearTimeout(refreshTimer.current)
      subscription.unsubscribe()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [clearAuthority, refreshProfile])

  const switchClinic = (clinicId: string) => {
    if (user?.clinic_memberships?.some(m => m.clinic_id === clinicId)) {
      selectedClinic.current = clinicId
      clearAuthority()
      void refreshProfile()
    } else {
      toast.error('No tienes acceso activo a esta clínica.')
    }
  }

  const login = async (email: string, password: string) => {
    loggingOut.current = false
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) return { error, requiresMfa: false }
    const [claims, assurance, factors] = await Promise.all([
      supabase.auth.getClaims(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ])
    if (claims.error || assurance.error || factors.error) {
      return { error: claims.error || assurance.error || factors.error, requiresMfa: false }
    }
    const hasVerifiedTotp = factors.data?.totp?.some(factor => factor.status === 'verified') === true
    const hasMfaAuthority = claims.data?.claims.aal === 'aal2'
      && assurance.data?.currentLevel === 'aal2' && assurance.data?.nextLevel === 'aal2' && hasVerifiedTotp
    return { error: null, requiresMfa: !hasMfaAuthority }
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
    loggingOut.current = false
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
    loggingOut.current = true
    clearTimeout(refreshTimer.current)
    ++refreshJob.current
    refreshing.current = false
    ++generation.current
    clearAuthority()
    setIsLoading(false)
    await supabase.auth.signOut()
  }

  const hasRole = (role: "doctor" | "receptionist" | "clinic_owner"): boolean => {
    return user?.role === role
  }

  return <AuthContext.Provider value={{ user, login, signup, resetPassword, signInWithGoogle, logout, isLoading, isRevalidating, hasRole, currentClinicId, switchClinic, refreshProfile, authError }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
