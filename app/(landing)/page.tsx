"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle, Smartphone, Shield, Zap, HeartPulse, Sparkles, Activity, Calendar } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/landing/layout/site-header"
import { SiteFooter } from "@/components/landing/layout/site-footer"
import { SectionHeader } from "@/components/landing/ui-elements/section-header"
import { FeatureCard } from "@/components/landing/ui-elements/feature-card"
import { TestimonialCard } from "@/components/landing/ui-elements/testimonial-card"
import { PricingCard } from "@/components/landing/ui-elements/pricing-card"

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState("hero")

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
      setActiveSection(sectionId)
    }
  }

  // Effect to update active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["hero", "features", "testimonials", "pricing", "contact"]
      
      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-neutral-50 font-text text-slate-900">
      <SiteHeader activeSection={activeSection} scrollToSection={scrollToSection} isHomePage={true} />

      {/* HERO SECTION */}
      <section id="hero" className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        <div className="absolute top-0 right-0 -z-10 opacity-30 transform translate-x-1/3 -translate-y-1/4">
          <svg width="800" height="800" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#2DD4BF" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,81.6,-46.6C91.4,-34.1,98.1,-19.2,95.8,-4.9C93.5,9.3,82.1,22.9,70.9,35.1C59.7,47.3,48.7,58.1,35.6,66.6C22.5,75.1,7.3,81.3,-7.1,80.1C-21.5,78.9,-35.1,70.3,-47.1,60.5C-59.1,50.7,-69.5,39.7,-76.1,26.8C-82.7,13.9,-85.5,-0.9,-81.4,-13.9C-77.3,-26.9,-66.3,-38.1,-54.2,-46.5C-42.1,-54.9,-28.9,-60.5,-15.8,-63.9C-2.7,-67.3,10.3,-68.5,23.3,-69.7L30.5,-83.6C30.5,-83.6,44.7,-76.4,44.7,-76.4Z" transform="translate(100 100)" />
          </svg>
        </div>
        
        <div className="container px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary font-subtitle">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
                Software Dental #1 en Latam
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 font-title">
                La forma <span className="text-primary relative">
                  moderna
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-30" viewBox="0 0 100 10" preserveAspectRatio="none">
                     <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="3" fill="none" />
                  </svg>
                </span> de gestionar tu clínica.
              </h1>
              <p className="text-xl text-gray-600 md:pr-10 leading-relaxed font-text">
                Simplifica la gestión de tus pacientes, citas y facturación con una plataforma intuitiva diseñada para dentistas modernos.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button size="lg" className="h-12 px-8 text-base bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg shadow-secondary/20 rounded-full font-subtitle" asChild>
                  <Link href="/free-trial">
                    Comenzar prueba gratis <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="h-12 px-8 text-base border-2 rounded-full hover:bg-slate-50 font-subtitle" asChild>
                  <Link href="/schedule-demo">
                    Agendar Demo
                  </Link>
                </Button>
              </div>
              <div className="pt-6 flex items-center gap-4 text-sm text-gray-500 font-subtitle">
                <div className="flex -space-x-2">
                   {[1,2,3,4].map(i => (
                     <div key={i} className={`w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden`}>
                        <img src={`/avatar-${i > 3 ? 1 : i}.png`} alt="User" onError={(e) => e.currentTarget.style.display='none'} className="w-full h-full object-cover" />
                     </div>
                   ))}
                </div>
                <div>
                   <span className="font-bold text-slate-900">500+</span> Dentistas confían en nosotros
                </div>
              </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ duration: 0.8, delay: 0.2 }}
               className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <img 
                  src="/odontologic-dashboard.png" 
                  alt="Dashboard Preview" 
                  className="w-full h-auto object-cover bg-white"
                  onError={(e) => {
                     e.currentTarget.src = "https://placehold.co/800x600/e2e8f0/475569?text=Dashboard+Preview"
                  }}
                />
                
                {/* Floating Elements */}
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl flex items-center gap-4 max-w-xs animate-bounce-slow"
                >
                   <div className="bg-green-100 p-3 rounded-full text-green-600">
                      <CheckCircle className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="font-bold text-slate-900 font-title">Cita Confirmada</p>
                      <p className="text-xs text-slate-500 font-subtitle">Hace 2 min • Dra. Ana</p>
                   </div>
                </motion.div>

                <motion.div 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="absolute -top-6 -right-6 bg-white p-4 rounded-xl shadow-xl flex items-center gap-4 max-w-xs"
                >
                   <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                      <Activity className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="font-bold text-slate-900 font-title">Ingresos +24%</p>
                      <p className="text-xs text-slate-500 font-subtitle">Este mes</p>
                   </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 bg-white">
        <div className="container px-4 md:px-6">
           <SectionHeader 
             badge="Características" 
             title={<>Todo lo que necesitas en <span className="text-primary">una sola plataforma</span></>}
             description="Herramientas potentes diseñadas para optimizar cada aspecto de tu práctica dental daily."
           />

           <div className="grid md:grid-cols-3 gap-8 mt-12">
             <FeatureCard 
               index={0}
               title="Agenda Inteligente"
               description="Evita huecos y optimiza tu tiempo con recordatorios automáticos por WhatsApp y Email."
               icon={<Calendar className="w-8 h-8 text-white" />}
               color="from-blue-500 to-cyan-400"
               benefits={["Sincronización en tiempo real", "Recordatorios automáticos", "Confirmaciones online"]}
             />
             <FeatureCard 
               index={1}
               title="Odontograma 3D"
               description="Visualiza y planifica tratamientos con precisión milimétrica y gráficos interactivos."
               icon={<Sparkles className="w-8 h-8 text-white" />}
               color="from-purple-500 to-pink-400"
               benefits={["Gráficos interactivos", "Historial visual", "Presupuestos automáticos"]}
             />
             <FeatureCard 
               index={2}
               title="Facturación Simple"
               description="Gestiona pagos, seguros y facturas electrónicas SRI sin dolores de cabeza."
               icon={<Shield className="w-8 h-8 text-white" />}
               color="from-emerald-500 to-green-400"
               benefits={["Facturación electrónica", "Control de pagos", "Reportes financieros"]}
             />
           </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="py-24 bg-slate-50">
        <div className="container px-4 md:px-6">
           <SectionHeader 
             badge="Testimonios"
             title="Lo que dicen nuestros doctores"
             description="Únete a cientos de profesionales que han transformado su clínica con Clinia+."
           />

           <div className="grid md:grid-cols-3 gap-8 mt-12">
              <TestimonialCard 
                 index={0}
                 name="Dr. Carlos Ruiz"
                 role="Ortodoncista"
                 quote="Clinia+ ha reducido nuestro ausentismo en un 40% gracias a los recordatorios automáticos. Es indispensable."
                 image="/avatar-1.png"
              />
              <TestimonialCard 
                 index={1}
                 name="Dra. María González"
                 role="Odontopediatra"
                 quote="El odontograma es increíblemente fácil de usar. Puedo explicar tratamientos a los padres mucho mejor."
                 image="/avatar-2.png"
              />
              <TestimonialCard 
                 index={2}
                 name="Dr. Juan Valencia"
                 role="Cirujano Maxilofacial"
                 quote="La facturación era una pesadilla antes. Ahora todo está integrado y cumplo con el SRI sin esfuerzo."
                 image="/avatar-3.png"
              />
           </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-white pointer-events-none"></div>
        <div className="container px-4 md:px-6 relative">
          <SectionHeader 
             badge="Precios Transparentes"
             title="Planes escalables para tu crecimiento"
             description="Sin contratos a largo plazo. Cancela cuando quieras."
           />

           <div className="grid lg:grid-cols-3 gap-8 mt-12 max-w-5xl mx-auto">
             <PricingCard 
                index={0}
                name="Start"
                price="$29"
                description="Ideal para consultorios individuales que recién empiezan."
                features={["1 Doctor", "Agenda básica", "Historia clínica simple", "5GB Almacenamiento"]}
                cta="Comenzar Gratis"
                popular={false}
                color="from-slate-400 to-slate-500"
                link="/free-trial"
             />
             <PricingCard 
                index={1}
                name="Pro"
                price="$59"
                description="La opción favorita para clínicas en crecimiento."
                features={["Hasta 3 Doctores", "Agenda Avanzada + WhatsApp", "Odontograma 3D", "Facturación Electrónica", "Reportes Avanzados"]}
                cta="Prueba Pro Gratis"
                popular={true}
                color="from-primary to-blue-600"
                link="/free-trial"
             />
             <PricingCard 
                index={2}
                name="Enterprise"
                price="$99"
                description="Para clínicas grandes y redes de consultorios."
                features={["Doctores Ilimitados", "Multisede", "API Access", "Soporte Prioritario 24/7", "Capacitación Personalizada"]}
                cta="Contactar Ventas"
                popular={false}
                color="from-slate-800 to-black"
                link="/schedule-demo"
             />
           </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-24 bg-primary text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
           <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
           </svg>
        </div>
        <div className="container px-4 md:px-6 relative text-center">
           <motion.div
             initial={{ opacity: 0, y: 30 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.8 }}
             className="max-w-3xl mx-auto space-y-8"
           >
             <h2 className="text-4xl md:text-5xl font-bold font-title">¿Listo para modernizar tu clínica?</h2>
             <p className="text-xl text-blue-100 font-text">
               Únete a la comunidad de dentistas que están definiendo el futuro de la odontología.
             </p>
             <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <Button size="lg" variant="secondary" className="h-14 px-10 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all font-subtitle" asChild>
                   <Link href="/free-trial">
                      Empieza tu Prueba de 14 Días
                   </Link>
                </Button>
             </div>
             <p className="text-sm text-blue-200 mt-6 font-text">Sin tarjeta de crédito requerida • Cancelación instantánea</p>
           </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
