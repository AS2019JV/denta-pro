'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react'
import { safeAuthRedirect } from '@/lib/auth-redirect'
import { completeVerifiedEnrollment } from '@/app/actions/complete-verified-enrollment'

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Estamos verificando el enlace de tu cuenta.')
  const verificationStarted = useRef(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (verificationStarted.current) return
    verificationStarted.current = true
    const verify = async () => {
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const next = safeAuthRedirect(searchParams.get('next'))

      // Clear URL parameters immediately for security and aesthetics
      if (typeof window !== 'undefined' && (token_hash || type)) {
        const url = new URL(window.location.href)
        url.search = ''
        window.history.replaceState({}, '', url.toString())
      }

      if (!token_hash || !type) {
        // If no token but we are already logged in, just redirect
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email_confirmed_at && (await completeVerifiedEnrollment()).success) {
          setStatus('success')
          router.push(next)
          return
        }
        setStatus('error')
        setMessage('El enlace de verificación no es válido o ya fue procesado.')
        return
      }

      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        })

        if (error) {
          console.error('Verification error:', error)
          
          // Check if user is already confirmed (common if scanner clicked first)
          const { data: { user } } = await supabase.auth.getUser()
          if (user?.email_confirmed_at && (await completeVerifiedEnrollment(type, token_hash)).success) {
            setStatus('success')
            setMessage('Tu correo ya está confirmado. Continuamos con tu acceso…')
            setTimeout(() => router.push(next), 1500)
            return
          }
          
          setStatus('error')
          setMessage(error.message === 'Token has expired or is invalid' 
            ? 'El enlace ha caducado. Por favor, solicita uno nuevo desde el inicio de sesión.' 
            : 'No pudimos verificar tu cuenta: ' + error.message)
        } else {
          if (!(await completeVerifiedEnrollment(type, token_hash)).success) {
            setStatus('error')
            setMessage('Tu correo fue confirmado, pero no se pudo completar el acceso a la clínica. Reabre el enlace para revisar la solicitud; si persiste, contacta al soporte.')
            return
          }
          setStatus('success')
          setMessage('Correo confirmado. Continuamos con la configuración de tu acceso…')
          setTimeout(() => {
            router.push(next)
          }, 2000)
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        setStatus('error')
        setMessage('Ocurrió un error inesperado. Inténtalo de nuevo más tarde.')
      }
    }

    verify()
  }, [searchParams, router, supabase])

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-6">
      <section className="w-full max-w-md space-y-5 text-center" aria-labelledby="confirmation-title">
        <div className={"mx-auto flex h-14 w-14 items-center justify-center rounded-2xl " + (status === 'error' ? "bg-rose-50 text-rose-700" : "bg-teal-50 text-teal-700")}>
          {status === 'error' ? <XCircle aria-hidden="true" className="h-7 w-7" /> : status === 'success' ? <CheckCircle2 aria-hidden="true" className="h-7 w-7" /> : <ShieldCheck aria-hidden="true" className="h-7 w-7" />}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary">Clinia+</p>
          <h1 id="confirmation-title" className="text-2xl font-semibold leading-tight">{status === 'loading' ? 'Verificando tu correo' : status === 'success' ? 'Correo confirmado' : 'No pudimos confirmar el correo'}</h1>
          <p role={status === 'error' ? 'alert' : 'status'} className="text-sm leading-relaxed text-muted-foreground">{message}</p>
        </div>
        {status === 'loading' && <Loader2 aria-label="Verificación en curso" className="mx-auto h-5 w-5 animate-spin text-primary" />}
        {status === 'error' && <button type="button" onClick={() => router.push('/login')} className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Volver a iniciar sesión</button>}
      </section>
    </main>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  )
}
