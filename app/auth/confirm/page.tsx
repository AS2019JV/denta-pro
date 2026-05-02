'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verificando tu identidad...')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const verify = async () => {
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const next = searchParams.get('next') ?? '/dashboard'

      // Clear URL parameters immediately for security and aesthetics
      if (typeof window !== 'undefined' && (token_hash || type)) {
        const url = new URL(window.location.href)
        url.search = ''
        window.history.replaceState({}, '', url.toString())
      }

      if (!token_hash || !type) {
        // If no token but we are already logged in, just redirect
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
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
          if (user?.email_confirmed_at) {
            setStatus('success')
            setMessage('Tu cuenta ya está activa. Entrando...')
            setTimeout(() => router.push(next), 1500)
            return
          }
          
          setStatus('error')
          setMessage(error.message === 'Token has expired or is invalid' 
            ? 'El enlace ha caducado. Por favor, solicita uno nuevo desde el inicio de sesión.' 
            : 'No pudimos verificar tu cuenta: ' + error.message)
        } else {
          setStatus('success')
          setMessage('¡Confirmación exitosa! Configurando tu espacio de trabajo...')
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
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100/50 rounded-full blur-3xl animate-pulse delay-700" />
      
      <div className="max-w-md w-full mx-4 z-10">
        <div className="bg-card/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-blue-900/5 p-10 border border-white text-center relative overflow-hidden">
          
          {status === 'loading' && (
            <div className="space-y-6 animate-in fade-in duration-700">
              <div className="relative h-24 w-24 mx-auto">
                <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25" />
                <div className="relative h-24 w-24 bg-card rounded-full flex items-center justify-center shadow-inner border border-blue-50">
                  <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Denta Pro</h1>
                <p className="text-slate-500 font-medium">{message}</p>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-1/3 animate-[progress_2s_ease-in-out_infinite]" />
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="h-24 w-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-100">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">¡Todo listo!</h1>
                <p className="text-slate-500 font-medium">{message}</p>
              </div>
              <div className="flex justify-center pt-2">
                 <div className="flex space-x-1">
                   <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-bounce" />
                   <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-bounce delay-150" />
                   <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-bounce delay-300" />
                 </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="h-24 w-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto border-2 border-rose-100">
                <XCircle className="h-12 w-12 text-rose-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Algo no salió bien</h1>
                <p className="text-slate-500 font-medium px-4 leading-relaxed">{message}</p>
              </div>
              <button
                onClick={() => router.push('/login')}
                className="group w-full py-4 px-6 bg-slate-900 text-white rounded-2xl font-semibold hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-lg shadow-slate-200"
              >
                <span>Volver al inicio</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>
        
        <p className="text-center mt-8 text-slate-400 text-sm font-medium uppercase tracking-widest">
          Clinica+ Management System
        </p>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  )
}

