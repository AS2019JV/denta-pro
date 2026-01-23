"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle, Shield, Zap, Activity, Calendar, Users, FileText, BarChart3 } from "lucide-react"

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
      <section id="hero" className="relative pt-20 pb-10 md:pt-24 md:pb-12 overflow-hidden bg-white max-h-[100vh] flex items-center">
        {/* Apple Pro Subtle Background - Refined */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
           <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-teal-100/30 rounded-full blur-[100px] opacity-50 mix-blend-multiply"></div>
           <div className="absolute bottom-[-20%] right-[10%] w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-[80px] opacity-50 mix-blend-multiply"></div>
        </div>
        
        <div className="container px-4 md:px-6 relative">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="space-y-8 text-center lg:text-left pt-2 md:pt-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50/50 border border-teal-100/50 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                </span>
                <span className="text-[11px] font-bold tracking-widest text-teal-700 uppercase font-subtitle">Dental Software #1</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tighter text-slate-900 font-title leading-[0.95] -ml-0.5">
                La clínica del 
                <br className="hidden lg:block" />
                <span className="inline-block text-transparent bg-clip-text bg-gradient-to-br from-teal-500 via-teal-600 to-blue-600 pb-2">
                  futuro, hoy.
                </span>
              </h1>
              
              <p className="text-xl text-slate-500 leading-relaxed font-text max-w-lg mx-auto lg:mx-0 font-light tracking-tight">
                Gestión inteligente, historias clínicas y analíticas. <span className="text-slate-800 font-medium">Todo en una sola plataforma.</span>
              </p>
              
              <div className="flex flex-col sm:flex-row gap-5 pt-4 justify-center lg:justify-start items-center">
                <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-teal-500 via-teal-600 to-teal-500 bg-[length:200%_auto] animate-gradient hover:bg-right hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.3)] text-white shadow-lg shadow-teal-900/10 rounded-full transition-all duration-300 active:scale-95 font-subtitle border border-teal-400/20" asChild>
                  <Link href="/free-trial">
                    Comenzar ahora
                  </Link>
                </Button>
                
                <div className="flex items-center gap-4 px-2 group cursor-default">
                  <div className="flex -space-x-4 transition-spacing duration-300 group-hover:-space-x-3">
                     {[1,2,3].map(i => (
                       <div key={i} className="w-10 h-10 rounded-full border-[3px] border-white bg-slate-100 overflow-hidden shadow-sm ring-1 ring-slate-100">
                          <img src={`/avatar-${i}.png`} alt="User" onError={(e) => e.currentTarget.style.display='none'} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                       </div>
                     ))}
                  </div>
                  <div className="flex flex-col text-left">
                     <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-slate-900">+500</span>
                        <div className="flex">
                          {[1,2,3,4,5].map(star => (
                            <svg key={star} className="w-3 h-3 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                          ))}
                        </div>
                     </div>
                     <span className="text-[11px] text-slate-500 font-medium">Doctores activos</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
               animate={{ opacity: 1, scale: 1, rotateY: 0 }}
               transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
               className="relative lg:h-auto z-10 perspective-1000"
            >
              {/* Premium 3D Glass Container */}
              <div className="relative rounded-2xl overflow-hidden shadow-[0_30px_60px_-10px_rgba(0,0,0,0.1)] border border-white/40 bg-white/50 backdrop-blur-sm ring-1 ring-black/5 transition-all duration-500 hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.15)] hover:-translate-y-1 group">
                <img 
                  src="/odontologic-dashboard.png" 
                  alt="Dashboard Preview" 
                  className="w-full h-auto object-cover shadow-sm"
                  onError={(e) => {
                     e.currentTarget.src = "https://placehold.co/800x600/f8fafc/64748b?text=App+Preview"
                  }}
                />
                
                {/* Floating Badge */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="absolute top-6 right-6 p-2 rounded-lg bg-white/80 backdrop-blur-md border border-white/50 shadow-md flex items-center gap-2"
                >
                   <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
                   <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">En vivo</span>
                </motion.div>
              </div>
              
              {/* Refined Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] bg-teal-500/20 blur-[90px] -z-10 rounded-full mix-blend-multiply"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 bg-white relative">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
        <div className="container px-4 md:px-6 relative">
           <SectionHeader 
             badge="Características" 
             title={<>Todo lo que necesitas en <span className="text-gradient">una sola plataforma</span></>}
             description="Herramientas potentes diseñadas para optimizar cada aspecto de tu práctica dental actual."
           />

           <div className="grid md:grid-cols-3 gap-8 mt-16">
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
               title="Historias Clínicas"
               description="Organiza expedientes, notas de evolución y planes de tratamiento en un solo lugar seguro."
               icon={<FileText className="w-8 h-8 text-white" />}
               color="from-teal-500 to-emerald-400"
               benefits={["Expedientes digitales", "Evolución de tratamiento", "Documentos adjuntos"]}
             />
             <FeatureCard 
               index={2}
               title="Analíticas de Crecimiento"
               description="Toma decisiones inteligentes con reportes en tiempo real sobre ingresos, pacientes y productividad."
               icon={<BarChart3 className="w-8 h-8 text-white" />}
               color="from-emerald-500 to-green-400"
               benefits={["Reportes financieros", "Métricas de pacientes", "Productividad por doctor"]}
             />
           </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="py-20 bg-slate-50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent"></div>
        <div className="container px-4 md:px-6 relative">
           <SectionHeader 
             badge="Testimonios"
             title="Lo que dicen nuestros doctores"
             description="Únete a cientos de profesionales que han transformado su clínica con Clinia+."
           />

           <div className="grid md:grid-cols-3 gap-8 mt-16">
              <TestimonialCard 
                 index={0}
                 name="Dr. Carlos Ruiz"
                 role="Ortodoncista"
                 quote="La agenda es tan intuitiva que mi asistente aprendió a usarla en minutos. Ahora todo el flujo de pacientes es perfecto."
                 image="/avatar-1.png"
              />
              <TestimonialCard 
                 index={1}
                 name="Dra. María González"
                 role="Odontopediatra"
                 quote="El odontograma digital es increíblemente intuitivo. Puedo explicar tratamientos a los padres mucho mejor."
                 image="/avatar-2.png"
              />
              <TestimonialCard 
                 index={2}
                 name="Dr. Juan Valencia"
                 role="Cirujano Maxilofacial"
                 quote="Antes operaba a ciegas. Ahora con las analíticas entiendo exactamente dónde enfocar mis esfuerzos para crecer."
                 image="/avatar-3.png"
              />
           </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-white to-white pointer-events-none"></div>
        <div className="container px-4 md:px-6 relative">
          <SectionHeader 
             badge="Precios Transparentes"
             title="Planes escalables para tu crecimiento"
             description="Sin contratos a largo plazo. Cancela cuando quieras."
           />

           <div className="grid lg:grid-cols-3 gap-8 mt-16 max-w-5xl mx-auto items-center">
             <PricingCard 
                index={0}
                 name="Start"
                 price="$27"
                 description="Ideal para consultorios individuales que recién empiezan."
                 features={["1 Doctor", "Agenda básica", "Historia clínica simple", "Acceso multidispositivo"]}
                cta="Comenzar Gratis"
                popular={false}
                color="from-slate-400 to-slate-500"
                link="/free-trial"
             />
             <PricingCard 
                index={1}
                 name="Pro"
                 price="$57"
                 description="La opción favorita para clínicas en crecimiento."
                 features={["Hasta 3 Doctores", "Agenda Avanzada + WhatsApp", "Odontograma Digital", "Analíticas de Crecimiento", "Soporte Prioritario"]}
                cta="Prueba Pro Gratis"
                popular={true}
                color="from-primary to-teal-500"
                link="/free-trial"
             />
             <PricingCard 
                index={2}
                 name="Enterprise"
                 price="$97"
                 description="Para clínicas grandes y redes de consultorios."
                 features={["Doctores Ilimitados", "Multisede", "Migración de Datos Asistida", "Soporte Prioritario 24/7", "Capacitación Personalizada"]}
                cta="Contactar Ventas"
                popular={false}
                color="from-slate-800 to-black"
                link="/schedule-demo"
             />
           </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-teal-700 to-teal-900"></div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        
        {/* Abstract shapes */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

        <div className="container px-4 md:px-6 relative text-center text-white">
           <motion.div
             initial={{ opacity: 0, y: 30 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.8 }}
             className="max-w-3xl mx-auto space-y-8"
           >
             <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold font-title tracking-tight">¿Listo para modernizar tu clínica?</h2>
             <p className="text-xl text-teal-50 font-text max-w-2xl mx-auto">
               Únete a la comunidad de dentistas que están definiendo el futuro de la odontología con tecnología de punta.
             </p>
             <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <Button size="lg" className="h-16 px-10 text-xl font-bold rounded-full shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] bg-white text-teal-950 hover:bg-teal-950 hover:text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] active:scale-95 font-subtitle group border border-transparent hover:border-teal-800" asChild>
                   <Link href="/free-trial" className="flex items-center gap-3">
                      Empieza tu Prueba de 14 Días
                      <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1 text-teal-600 group-hover:text-teal-400" />
                   </Link>
                </Button>
             </div>
             <p className="text-sm text-teal-200 mt-6 font-text opacity-80">Sin tarjeta de crédito requerida • Cancelación instantánea</p>
           </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
