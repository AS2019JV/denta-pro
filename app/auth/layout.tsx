import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Clinia+ | Confirmación de acceso',
  description: 'Confirma tu correo para continuar a Clinia+.',
  icons: { icon: '/brand-logo.png' },
}

export default function AuthLinkLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es-EC"><body>{children}</body></html>
}
