'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth-context'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Factor = { id: string; friendly_name?: string | null }

export default function MfaPage() {
  const router = useRouter()
  const { refreshProfile } = useAuth()
  const [busy, setBusy] = useState(true)
  const [working, setWorking] = useState(false)
  const [mode, setMode] = useState<'enroll' | 'challenge' | 'pending'>('enroll')
  const [factorId, setFactorId] = useState('')
  const [factors, setFactors] = useState<Factor[]>([])
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [{ data: identity, error: identityError }, { data: claims, error: claimsError }, assurance, listed] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getClaims(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ])
        if (!active) return
        if (identityError || !identity.user || claimsError || claims?.claims.sub !== identity.user.id
          || claims.claims.role !== 'authenticated' || assurance.error || listed.error) {
          router.replace('/login')
          return
        }

        const verified = listed.data?.totp?.filter(factor => factor.status === 'verified') || []
        const unverified = listed.data?.all?.some(factor => factor.factor_type === 'totp' && factor.status === 'unverified') === true
        const hasCurrentMfa = claims.claims.aal === 'aal2' && assurance.data?.currentLevel === 'aal2'
          && assurance.data?.nextLevel === 'aal2' && verified.length > 0
        if (hasCurrentMfa) {
          await refreshProfile()
          if (active) router.replace('/dashboard')
          return
        }
        if (verified.length) {
          setFactors(verified.map(factor => ({ id: factor.id, friendly_name: factor.friendly_name })))
          setFactorId(verified[0].id)
          setMode('challenge')
        } else if (unverified) {
          setMode('pending')
        } else {
          setMode('enroll')
        }
      } catch {
        if (active) setError('No se pudo validar tu sesión. Inicia sesión de nuevo e inténtalo otra vez.')
      } finally {
        if (active) setBusy(false)
      }
    }
    void load()
    return () => { active = false }
  }, [refreshProfile, router])

  const startEnrollment = async () => {
    setWorking(true)
    setError('')
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Clinia+ authenticator',
      })
      if (enrollError || !data?.id || !data.totp?.qr_code || !data.totp?.secret) throw enrollError || new Error('Enrollment response incomplete')
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setMode('challenge')
      setFactors([])
    } catch {
      setError('No se pudo iniciar la configuración del autenticador. Revisa la conexión e inténtalo otra vez.')
    } finally {
      setWorking(false)
    }
  }

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code) || !factorId) {
      setError('Escribe el código de seis dígitos de tu aplicación autenticadora.')
      return
    }
    setWorking(true)
    setError('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError || !challenge?.id) throw challengeError || new Error('Challenge unavailable')
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
      if (verifyError) throw verifyError

      // Require a newly issued, verified AAL2 token and a currently verified
      // TOTP factor before profile loading or navigation to clinical routes.
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshed.session) throw refreshError || new Error('Session refresh failed')
      const [claims, assurance, listed] = await Promise.all([
        supabase.auth.getClaims(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])
      const verified = listed.data?.totp?.some(factor => factor.status === 'verified') === true
      if (claims.error || claims.data?.claims.aal !== 'aal2' || assurance.error
        || assurance.data?.currentLevel !== 'aal2' || assurance.data?.nextLevel !== 'aal2'
        || listed.error || !verified) throw new Error('AAL2 verification not confirmed')

      setQrCode('')
      setSecret('')
      await refreshProfile()
      router.replace('/dashboard')
    } catch {
      setError('El código no se pudo verificar. Comprueba que sea el código actual y vuelve a intentarlo.')
      setCode('')
    } finally {
      setWorking(false)
    }
  }

  const logout = async () => {
    setWorking(true)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#E8D9C9]/20 px-4 py-8">
      <Card className="w-full max-w-lg rounded-3xl border-0 bg-card shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <ShieldCheck aria-hidden="true" className="h-7 w-7" />
          </div>
          <CardTitle>Verificación de dos pasos</CardTitle>
          <CardDescription>Configura o verifica tu autenticador para proteger el acceso clínico.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {busy ? (
            <div className="flex items-center justify-center gap-2 py-8" role="status">
              <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              <span>Validando sesión…</span>
            </div>
          ) : mode === 'pending' ? (
            <div className="space-y-4">
              <Alert><AlertDescription>Hay una configuración de autenticador sin terminar. Vuelve a la pestaña donde generaste el código QR. Si ya no tienes ese código, contacta a soporte para recuperar el acceso.</AlertDescription></Alert>
              <Button className="w-full" variant="outline" onClick={logout} disabled={working}>Cerrar sesión</Button>
            </div>
          ) : mode === 'enroll' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Necesitas una aplicación autenticadora compatible con códigos TOTP. El código cambia cada 30 segundos.</p>
              <Button className="w-full" onClick={startEnrollment} disabled={working}>
                {working && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
                Configurar autenticador
              </Button>
            </div>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              {qrCode ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm">Escanea el código QR en tu aplicación. Si no puedes, copia la clave manualmente.</p>
                  <img className="mx-auto h-48 w-48 rounded-lg border bg-white p-2" src={qrCode} alt="Código QR para configurar el autenticador" />
                  <p className="break-all rounded-lg bg-muted p-3 text-left text-sm"><span className="font-medium">Clave manual: </span><code>{secret}</code></p>
                </div>
              ) : factors.length > 1 ? (
                <div className="space-y-2">
                  <Label htmlFor="factor">Autenticador</Label>
                  <select id="factor" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={factorId} onChange={event => setFactorId(event.target.value)}>
                    {factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Autenticador ${index + 1}`}</option>)}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Abre tu aplicación autenticadora e ingresa el código actual.</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="totp-code">Código de seis dígitos</Label>
                <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
              </div>
              <Button className="w-full" type="submit" disabled={working || code.length !== 6 || !factorId}>
                {working && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
                Verificar y continuar
              </Button>
            </form>
          )}
          {!busy && mode === 'challenge' && !qrCode && <Button className="w-full" variant="outline" onClick={logout} disabled={working}>Cerrar sesión</Button>}
        </CardContent>
      </Card>
    </main>
  )
}
