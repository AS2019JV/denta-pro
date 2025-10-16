"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface User {
  id: string
  name: string
  email: string
  role: "doctor" | "reception"
  avatar: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
  hasRole: (role: "doctor" | "reception") => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Demo users
const demoUsers: User[] = [
  {
    id: "1",
    name: "Dr. María González",
    email: "maria.gonzalez@dentapro.com",
    role: "doctor",
    avatar: "MG",
  },
  {
    id: "2",
    name: "Ana Rodríguez",
    email: "ana.rodriguez@dentapro.com",
    role: "reception",
    avatar: "AR",
  },
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for stored user session
    const storedUser = localStorage.getItem("dentapro_user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    // Demo authentication - in real app, this would be an API call
    const foundUser = demoUsers.find((u) => u.email === email)

    if (foundUser && password === "123456") {
      setUser(foundUser)
      localStorage.setItem("dentapro_user", JSON.stringify(foundUser))
      return true
    }

    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("dentapro_user")
  }

  const hasRole = (role: "doctor" | "reception"): boolean => {
    return user?.role === role
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading, hasRole }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
