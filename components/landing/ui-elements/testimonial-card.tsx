"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"

interface TestimonialCardProps {
  name: string
  role: string
  quote: string
  image: string
  index: number
}

export function TestimonialCard({ name, role, quote, image, index }: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card className="border-none shadow-md hover:shadow-xl transition-all h-full overflow-hidden group">
        <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/80"></div>
        <CardContent className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <img
              src={image || "/placeholder.svg"}
              alt={name}
              className="rounded-full h-14 w-14 object-cover ring-2 ring-primary/20 group-hover:ring-primary transition-all"
            />
            <div>
              <h4 className="font-bold font-title">{name}</h4>
              <p className="text-gray-500 text-sm font-subtitle">{role}</p>
            </div>
          </div>
          <div className="relative mb-6">
            <div className="absolute -top-2 -left-2 text-4xl text-primary/20">"</div>
            <p className="text-gray-700 italic relative z-10 font-text">{quote}</p>
            <div className="absolute -bottom-2 -right-2 text-4xl text-primary/20">"</div>
          </div>
          <div className="flex text-secondary">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

