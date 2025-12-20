"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Award,
  Calendar,
  CheckCircle,
  Clock,
  Heart,
  HeartPulse,
  Lightbulb,
  Target,
  Users,
} from "lucide-react"

import { Button } from "@/components/landing/ui/button"
import { Card, CardContent } from "@/components/landing/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/landing/ui/tabs"
import { SiteHeader } from "@/components/landing/layout/site-header"
import { SiteFooter } from "@/components/landing/layout/site-footer"
import { SectionHeader } from "@/components/landing/ui-elements/section-header"

export default function AboutUsPage() {
  const [activeTab, setActiveTab] = useState("historia")

  // Datos del equipo
  const teamMembers = [
    {
      name: "Dr. Carlos Martínez",
      role: "Fundador y CEO",
      bio: "Odontólogo con más de 15 años de experiencia clínica. Fundó Clinia+ tras identificar la necesidad de soluciones tecnológicas específicas para clínicas dentales.",
      image: "/team-ceo.png",
    },
    {
      name: "Laura Sánchez",
      role: "Directora de Producto",
      bio: "Ingeniera de software con experiencia en el sector sanitario. Lidera el desarrollo de productos centrados en mejorar la experiencia de usuarios clínicos.",
      image: "/team-cto.png",
    },
    {
      name: "Miguel Torres",
      role: "Director de Tecnología",
      bio: "Especialista en arquitectura de software con enfoque en seguridad y cumplimiento normativo en el sector sanitario.",
      image: "/team-product.png",
    },
    {
      name: "Ana García",
      role: "Directora de Experiencia de Cliente",
      bio: "Ex-gerente de clínica dental, ahora lidera nuestro equipo de soporte y formación para garantizar el éxito de nuestros clientes.",
      image: "/team-cs.png",
    },
  ]

  // Datos de la cronología
  const timeline = [
    {
      year: "2018",
      title: "Fundación",
      description: "Clinia+ nace como proyecto para resolver los problemas de gestión en clínicas dentales.",
    },
    {
      year: "2019",
      title: "Primer lanzamiento",
      description:
        "Lanzamiento de la primera versión del software con funcionalidades básicas de agenda y gestión de pacientes.",
    },
    {
      year: "2020",
      title: "Expansión nacional",
      description: "Alcanzamos las 500 clínicas en España y ampliamos nuestro equipo de desarrollo.",
    },
    {
      year: "2021",
      title: "Integración con seguros",
      description: "Implementamos la verificación automática de seguros y procesamiento de reclamaciones.",
    },
    {
      year: "2022",
      title: "Ficha dental 3D",
      description: "Lanzamiento de nuestra innovadora ficha dental interactiva en 3D.",
    },
    {
      year: "2023",
      title: "Expansión internacional",
      description: "Comenzamos operaciones en Portugal, México y Colombia.",
    },
    {
      year: "2024",
      title: "Inteligencia Artificial",
      description: "Incorporamos funcionalidades de IA para predicción de ausencias y optimización de agenda.",
    },
  ]

  // Valores de la empresa
  const values = [
    {
      icon: <Heart className="h-8 w-8 text-white" />,
      title: "Centrados en el paciente",
      description: "Diseñamos cada función pensando en cómo mejorar la experiencia del paciente en la clínica dental.",
    },
    {
      icon: <Lightbulb className="h-8 w-8 text-white" />,
      title: "Innovación constante",
      description: "Buscamos continuamente nuevas formas de resolver los desafíos de las clínicas dentales modernas.",
    },
    {
      icon: <Users className="h-8 w-8 text-white" />,
      title: "Colaboración",
      description:
        "Trabajamos estrechamente con profesionales dentales para desarrollar soluciones que realmente funcionen.",
    },
    {
      icon: <Award className="h-8 w-8 text-white" />,
      title: "Excelencia",
      description: "Nos comprometemos con los más altos estándares de calidad en todo lo que hacemos.",
    },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader isHomePage={false} />

      <main className="flex-1 pt-20">
        {/* Hero Section */}
        <section className="relative w-full py-20 md:py-28 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
          <div className="absolute inset-0 opacity-20">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                  <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="container relative z-10 px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto text-center"
            >
              <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-1 text-sm text-white backdrop-blur-sm mb-6 font-subtitle">
                <span className="mr-2 h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
                Sobre Nosotros
              </div>
              <h1 className="text-4xl font-bold tracking-tighter text-white sm:text-5xl md:text-6xl mb-6 font-title">
                Transformando la odontología con tecnología
              </h1>
              <p className="text-white/80 text-xl mb-8 max-w-2xl mx-auto font-text">
                Conoce al equipo detrás de Clinia+ y nuestra misión de revolucionar la gestión de clínicas dentales.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Nuestra Historia Section */}
        <section className="w-full py-20 md:py-28">
          <div className="container px-4 md:px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-sm text-primary mb-4 font-subtitle">
                  <span className="mr-2 h-2 w-2 rounded-full bg-primary"></span>
                  Nuestra Historia
                </div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl mb-6 font-title">
                  De la frustración a la innovación
                </h2>
                <div className="space-y-4 text-gray-600 font-text">
                  <p>
                    Clinia+ nació en 2018 de la frustración del Dr. Carlos Martínez con los sistemas de gestión
                    disponibles para su clínica dental. Ninguna solución existente abordaba los desafíos específicos que
                    enfrentaban los profesionales dentales en su día a día.
                  </p>
                  <p>
                    Lo que comenzó como un proyecto para resolver problemas en su propia clínica rápidamente se
                    convirtió en una misión para transformar la gestión de clínicas dentales en todo el mundo. Reunió a
                    un equipo de expertos en tecnología y profesionales dentales para crear una solución verdaderamente
                    centrada en las necesidades del sector.
                  </p>
                  <p>
                    Hoy, Clinia+ es utilizado por más de 10,000 clínicas en 5 países, y seguimos creciendo con la
                    misma pasión por simplificar la gestión clínica y mejorar la experiencia tanto de profesionales como
                    de pacientes.
                  </p>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Button className="bg-primary hover:bg-primary/90 text-white font-subtitle" asChild>
                    <Link href="/schedule-demo">
                      Programa una Demo
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 to-tertiary/10 rounded-3xl blur-3xl"></div>
                <div className="relative bg-white rounded-2xl overflow-hidden shadow-xl">
                  <img
                    src="/team-group.png"
                    alt="Equipo de Clinia+"
                    className="w-full h-auto"
                  />
                </div>

                <div className="absolute -bottom-6 -right-6 bg-white rounded-xl shadow-lg p-4 max-w-xs">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 rounded-full p-3">
                      <HeartPulse className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">+10,000</h4>
                      <p className="text-gray-500 font-subtitle">Clínicas confían en nosotros</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Misión y Valores Section */}
        <section className="w-full py-20 md:py-28 bg-[#F8F9FA]">
          <div className="container px-4 md:px-6">
            <SectionHeader
              badge="Misión y Valores"
              title="Lo que nos impulsa cada día"
              description="Nuestra misión es simplificar la gestión de clínicas dentales para que los profesionales puedan centrarse en lo que realmente importa: sus pacientes."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {values.map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group"
                >
                  <Card className="border-none shadow-md hover:shadow-xl transition-all h-full overflow-hidden">
                    <CardContent className="p-8">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        {value.icon}
                      </div>
                      <h3 className="text-xl font-bold mb-3 font-title">{value.title}</h3>
                      <p className="text-gray-600 font-text">{value.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mt-20 max-w-6xl mx-auto"
            >
              <div className="bg-white rounded-3xl overflow-hidden shadow-xl p-8 md:p-12">
                <div className="grid md:grid-cols-3 gap-8 items-center">
                  <div className="md:col-span-1">
                    <div className="bg-primary/10 rounded-full p-4 inline-flex">
                      <Target className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold mt-4 mb-2 font-title">Nuestra visión</h3>
                    <p className="text-gray-600 font-text">
                      Ser el aliado tecnológico preferido por las clínicas dentales en todo el mundo, impulsando la
                      excelencia en la atención dental.
                    </p>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {[
                      {
                        icon: <CheckCircle className="h-5 w-5 text-tertiary" />,
                        title: "Centrados en resultados",
                        description:
                          "Nos enfocamos en generar impacto real y medible en la eficiencia de las clínicas.",
                      },
                      {
                        icon: <CheckCircle className="h-5 w-5 text-tertiary" />,
                        title: "Mejora continua",
                        description: "Evolucionamos constantemente nuestras soluciones basándonos en feedback real.",
                      },
                      {
                        icon: <CheckCircle className="h-5 w-5 text-tertiary" />,
                        title: "Tecnología accesible",
                        description:
                          "Hacemos que la tecnología avanzada sea accesible para clínicas de todos los tamaños.",
                      },
                      {
                        icon: <CheckCircle className="h-5 w-5 text-tertiary" />,
                        title: "Seguridad y cumplimiento",
                        description:
                          "Priorizamos la seguridad de los datos y el cumplimiento normativo en todo momento.",
                      },
                    ].map((item, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="mt-1 bg-tertiary/10 rounded-full p-1">{item.icon}</div>
                        <div>
                          <h4 className="font-medium font-subtitle">{item.title}</h4>
                          <p className="text-sm text-gray-500 font-text">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Nuestro Equipo Section */}
        <section className="w-full py-20 md:py-28">
          <div className="container px-4 md:px-6">
            <SectionHeader
              badge="Nuestro Equipo"
              title="Las mentes detrás de Clinia+"
              description="Un equipo multidisciplinar de profesionales apasionados por transformar la odontología con tecnología."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {teamMembers.map((member, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="border-none shadow-md hover:shadow-xl transition-all overflow-hidden group">
                    <div className="relative overflow-hidden">
                      <img
                        src={member.image || "/placeholder.svg"}
                        alt={member.name}
                        className="w-full aspect-square object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div className="p-4 text-white">
                          <p className="text-sm">{member.bio}</p>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold font-title">{member.name}</h3>
                      <p className="text-secondary font-subtitle">{member.role}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white font-subtitle">
                Ver Equipo Completo
              </Button>
            </div>
          </div>
        </section>

        {/* Nuestra Trayectoria Section */}
        <section className="w-full py-20 md:py-28 bg-[#F8F9FA]">
          <div className="container px-4 md:px-6">
            <SectionHeader
              badge="Nuestra Trayectoria"
              title="Un viaje de innovación continua"
              description="Desde nuestros inicios hasta hoy, cada paso ha sido guiado por nuestra misión de transformar la gestión dental."
            />

            <div className="max-w-4xl mx-auto">
              <Tabs defaultValue="historia" className="w-full" onValueChange={setActiveTab}>
                <div className="flex justify-center mb-8">
                  <TabsList className="grid grid-cols-2 w-full max-w-md">
                    <TabsTrigger value="historia">Historia</TabsTrigger>
                    <TabsTrigger value="logros">Logros</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="historia" className="mt-0">
                  <div className="relative border-l-2 border-primary/20 pl-8 ml-4 space-y-12">
                    {timeline.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={activeTab === "historia" ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="relative"
                      >
                        <div className="absolute -left-[41px] bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="bg-white rounded-lg shadow-md p-6">
                          <div className="inline-block bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-sm mb-2 font-subtitle">
                            {item.year}
                          </div>
                          <h3 className="text-xl font-bold mb-2 font-title">{item.title}</h3>
                          <p className="text-gray-600 font-text">{item.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="logros" className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[
                      {
                        number: "10,000+",
                        text: "Clínicas dentales",
                        description: "Más de 10,000 clínicas en 5 países confían en Clinia+ para su gestión diaria.",
                      },
                      {
                        number: "30M+",
                        text: "Citas gestionadas",
                        description:
                          "Hemos ayudado a gestionar más de 30 millones de citas dentales desde nuestro lanzamiento.",
                      },
                      {
                        number: "60%",
                        text: "Reducción de ausencias",
                        description:
                          "Nuestros clientes experimentan una reducción media del 60% en ausencias de pacientes.",
                      },
                      {
                        number: "98%",
                        text: "Tasa de retención",
                        description: "El 98% de nuestros clientes renuevan su suscripción anualmente.",
                      },
                    ].map((stat, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={activeTab === "logros" ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      >
                        <Card className="border-none shadow-md hover:shadow-xl transition-all h-full">
                          <CardContent className="p-8">
                            <div className="flex flex-col items-center text-center">
                              <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
                                <Clock className="h-8 w-8 text-white" />
                              </div>
                              <h3 className="text-4xl font-bold text-secondary mb-2 font-title">{stat.number}</h3>
                              <h4 className="text-xl font-medium mb-4 font-subtitle">{stat.text}</h4>
                              <p className="text-gray-600 font-text">{stat.description}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative w-full py-20 md:py-28 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid-cta" width="60" height="60" patternUnits="userSpaceOnUse">
                  <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid-cta)" />
            </svg>
          </div>

          <div className="container relative z-10 px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto text-center"
            >
              <div className="inline-flex items-center gap-2 mb-6">
                <div className="h-px w-12 bg-white/30"></div>
                <p className="text-white/60 text-sm">ÚNETE A NUESTRA COMUNIDAD</p>
                <div className="h-px w-12 bg-white/30"></div>
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight lg:text-5xl mb-6 text-white font-title">
                Forma parte de la revolución dental
              </h2>
              <p className="text-white/80 text-xl mb-8 max-w-2xl mx-auto font-text">
                Descubre cómo Clinia+ puede transformar tu clínica dental y mejorar la experiencia de tus pacientes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="relative overflow-hidden bg-secondary hover:bg-secondary/90 text-secondary-foreground text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all group font-subtitle"
                  asChild
                >
                  <Link href="/free-trial">
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-secondary/0 via-white/20 to-secondary/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
                    Comienza Tu Prueba Gratuita
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-cuaternary bg-cuaternary/10 text-white hover:bg-cuaternary/20 text-lg px-8 py-6 rounded-full font-subtitle"
                  asChild
                >
                  <Link href="/schedule-demo">Programa una Demo</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

