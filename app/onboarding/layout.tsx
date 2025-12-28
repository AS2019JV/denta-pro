import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Clinia + | Configura tu Clínica",
  description: "Crea tu espacio de trabajo en Clinia +",
}

export default function OnboardingLayoutChild({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {children}
    </>
  )
}
