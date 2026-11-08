'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export function AuthenticatorGuide() {
  return <div className="rounded-lg border bg-muted/30 p-3 text-sm">
    <p>¿Necesitas ayuda para empezar?</p>
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto whitespace-normal px-0 text-left">Guía de verificación en dos pasos</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configura Google Authenticator</DialogTitle>
          <DialogDescription>Tiempo orientativo: 3 minutos, más la descarga de la aplicación.</DialogDescription>
        </DialogHeader>
        <p className="text-sm">Además de tu contraseña, Clinia+ pide un código de tu móvil. Esta segunda verificación ayuda a proteger tu cuenta si alguien conoce tu contraseña.</p>
        <ol className="list-decimal space-y-4 pl-5 text-sm">
          <li><strong>Instala la aplicación oficial de Google.</strong>
            <div className="mt-2 flex flex-wrap gap-3">
              <a className="underline" href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer">Android · Google Play</a>
              <a className="underline" href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer">iPhone · App Store</a>
            </div>
            <p className="mt-1 text-muted-foreground">Google Authenticator también puede usarse sin una cuenta de Google.</p>
          </li>
          <li><strong>Vincula tu cuenta de Clinia+.</strong> Vuelve aquí y pulsa «Configurar autenticador». En Google Authenticator pulsa «+» y escanea el QR.
            <p className="mt-1 text-muted-foreground">Si estás en el mismo móvil, elige «Introducir clave de configuración», copia la clave que muestra Clinia+ y selecciona «Basada en tiempo».</p>
          </li>
          <li><strong>Confirma el código.</strong> Escribe en Clinia+ los seis dígitos que aparecen en la aplicación y pulsa «Verificar y continuar». Si caduca, usa el siguiente código. Mantén la fecha y hora del móvil en automático.</li>
        </ol>
        <p className="rounded-lg bg-muted p-3 text-sm">Nunca compartas el QR, la clave ni los códigos, tampoco con soporte. Antes de cambiar de móvil, transfiere tus códigos siguiendo la guía de Google.</p>
        <p className="text-sm text-muted-foreground">También puedes usar otra aplicación compatible con TOTP. <a className="underline" href="https://support.google.com/accounts/answer/1066447?hl=es" target="_blank" rel="noopener noreferrer">Ayuda oficial de Google</a></p>
      </DialogContent>
    </Dialog>
  </div>
}
