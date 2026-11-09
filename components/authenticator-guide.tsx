'use client'

import { Smartphone, ScanLine, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export function AuthenticatorGuide() {
  return <div className="rounded-lg border bg-muted/20 px-3 py-3 text-center">
    <p className="text-sm text-muted-foreground">¿Primera vez con un autenticador?</p>
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto whitespace-normal px-0 py-1 text-sm font-medium">Guía rápida de verificación</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto p-5 text-left sm:p-6">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-2xl">Tu acceso, en tres pasos</DialogTitle>
          <DialogDescription>Un código del móvil añade protección a tu contraseña.<span className="mt-1 block text-xs">Unos 3 minutos, más la descarga.</span></DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Smartphone aria-hidden="true" className="h-5 w-5" /></span>
            <div className="min-w-0 break-words"><h3 className="font-semibold">1. Instala</h3><p className="mt-1 text-muted-foreground">Google Authenticator, de Google.</p>
              <div className="flex gap-4"><a className="inline-flex min-h-11 items-center underline" href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer">Android</a><a className="inline-flex min-h-11 items-center underline" href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer">iPhone</a></div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><ScanLine aria-hidden="true" className="h-5 w-5" /></span>
            <div className="min-w-0 break-words"><h3 className="font-semibold">2. Vincula</h3><p className="mt-1 text-muted-foreground">En Clinia+, pulsa «Configurar autenticador». En la app, toca «+» y escanea el QR.</p></div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><KeyRound aria-hidden="true" className="h-5 w-5" /></span>
            <div className="min-w-0 break-words"><h3 className="font-semibold">3. Verifica</h3><p className="mt-1 text-muted-foreground">Escribe aquí los seis dígitos y pulsa «Verificar y continuar».</p></div>
          </li>
        </ol>
        <details className="rounded-lg border px-3 py-2 text-sm">
          <summary className="cursor-pointer py-1 font-medium">¿Estás en el mismo móvil?</summary>
          <p className="mt-2 text-muted-foreground">En la app, elige «Introducir clave de configuración», copia la clave privada de Clinia+ y selecciona «Basada en tiempo». Si el código falla, activa la fecha y hora automáticas del móvil.</p>
        </details>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">No compartas el QR, la clave ni los códigos, tampoco con soporte.</p>
        <a className="text-center text-xs underline" href="https://support.google.com/accounts/answer/1066447?hl=es" target="_blank" rel="noopener noreferrer">Ayuda oficial de Google</a>
      </DialogContent>
    </Dialog>
  </div>
}
