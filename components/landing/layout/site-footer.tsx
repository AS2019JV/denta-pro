import Link from "next/link"
import { HeartPulse } from "lucide-react"

export function SiteFooter({ simplified = false }) {
  if (simplified) {
    return (
      <footer className="w-full bg-white py-6">
        <div className="container text-center text-gray-500 text-sm font-text">
          © 2026 Clinia+. Todos los derechos reservados.
        </div>
      </footer>
    )
  }

  return (
    <footer className="w-full bg-white py-12 font-text">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 font-bold text-xl mb-4 font-title text-primary">
              <img src="/brand-logo.png" alt="Clinia+" className="h-8 w-auto" />
              <span>Clinia+</span>
            </div>
            <p className="text-gray-500 mb-4 max-w-xs font-text">
              Software moderno de gestión para clínicas dentales que simplifica tu flujo de trabajo y mejora la atención
              al paciente.
            </p>
            <div className="flex space-x-4">
              {[
                { href: "#", path: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" },
                {
                  href: "#",
                  path: "M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z",
                },
                {
                  href: "#",
                  path: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z",
                  extraPaths: [
                    "<rect width='20' height='20' x='2' y='2' rx='5' ry='5'></rect>",
                    "<line x1='17.5' x2='17.51' y1='6.5' y2='6.5'></line>",
                  ],
                },
                {
                  href: "#",
                  path: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z",
                  extraPaths: [
                    "<rect width='4' height='12' x='2' y='9'></rect>",
                    "<circle cx='4' cy='4' r='2'></circle>",
                  ],
                },
              ].map((social, index) => (
                <Link key={index} href={social.href} className="text-gray-400 hover:text-secondary transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d={social.path}></path>
                    {social.extraPaths?.map((path, i) => (
                      <path key={i} d={path}></path>
                    ))}
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-4 font-subtitle">Producto</h3>
            <ul className="space-y-2">
              {[
                { href: "#features", label: "Características" },
                { href: "#pricing", label: "Precios" },
                { href: "#", label: "Integraciones" },
                { href: "#", label: "Actualizaciones" },
              ].map((link, index) => (
                <li key={index}>
                  <Link href={link.href} className="text-gray-500 hover:text-secondary transition-colors font-subtitle">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-4 font-subtitle">Empresa</h3>
            <ul className="space-y-2">
              {[
                { href: "#", label: "Sobre nosotros" },
                { href: "#", label: "Blog" },
                { href: "#", label: "Empleo" },
                { href: "#contact", label: "Contacto" },
              ].map((link, index) => (
                <li key={index}>
                  <Link href={link.href} className="text-gray-500 hover:text-secondary transition-colors font-subtitle">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-4 font-subtitle">Recursos</h3>
            <ul className="space-y-2">
              {[
                { href: "#", label: "Documentación" },
                { href: "#", label: "Centro de ayuda" },
                { href: "#", label: "Comunidad" },
                { href: "#", label: "Webinars" },
              ].map((link, index) => (
                <li key={index}>
                  <Link href={link.href} className="text-gray-500 hover:text-secondary transition-colors font-subtitle">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center font-text">
          <p className="text-gray-500 text-sm">© 2026 Clinia+. Todos los derechos reservados.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="#" className="text-gray-500 hover:text-secondary text-sm transition-colors">
              Política de Privacidad
            </Link>
            <Link href="#" className="text-gray-500 hover:text-secondary text-sm transition-colors">
              Términos de Servicio
            </Link>
            <Link href="#" className="text-gray-500 hover:text-secondary text-sm transition-colors">
              Cumplimiento HIPAA
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

