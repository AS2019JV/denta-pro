"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "@/components/translations"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import { Building2, MapPin, Phone, User, Mail } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "", // Read-only if auth
    phone: "",
    clinicName: "",
    clinicSize: "1-2",
    currentSoftware: "",
    additionalInfo: ""
  })



  // Pre-fill email if possible
  React.useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setFormData(prev => ({ ...prev, email: user.email! }))
      }
    }
    getUser()
  }, [])

  const handleCreateClinic = async () => {
    setLoading(true)

    try {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error(t("loginTitle")) 

      // 2. Call Secure Genesis RPC
      // This creates the Clinic and the Owner Profile atomically
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_tenant_clinic', {
        clinic_name: formData.clinicName,
        clinic_address: "Not Provided", // We can ask for this or default it
        clinic_phone: formData.phone
      })

      if (rpcError) throw rpcError

      // 3. Update the newly created Profile & Clinic with extra details
      // The RPC sets name to 'Clinic Admin' and defaults. We now enrich it.
      
      const fullName = `${formData.firstName} ${formData.lastName}`.trim()
      
      // Update Profile Name
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: formData.phone
        })
        .eq("id", user.id)

      if (profileError) throw profileError

      // Update Clinic Metadata (Size, Software, Notes)
      if (rpcData?.clinic_id) {
          const { error: clinicUpdateError } = await supabase
            .from("clinics")
            .update({
               size: formData.clinicSize,
               previous_software: formData.currentSoftware,
               onboarding_notes: formData.additionalInfo
            })
            .eq("id", rpcData.clinic_id)
            
          if (clinicUpdateError) console.error("Error updating clinic metadata", clinicUpdateError)
      }

      toast.success("Clinic created successfully!")
      
      // Force refresh to update session claims (Custom Auth Hook needs new token)
      await supabase.auth.refreshSession()
      
      router.push("/")
      router.refresh()

    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to create clinic")
    } finally {
      setLoading(false)
    }
  }

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault()
    setStep(2)
  }

  const prevStep = () => {
    setStep(1)
  }

  return (
    <div className="container max-w-2xl mx-auto py-20 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">{t("onboarding-title")}</h1>
        <p className="text-muted-foreground">{t("onboarding-subtitle")}</p>
      </div>

      <Card>
        <form onSubmit={step === 1 ? nextStep : (e) => { e.preventDefault(); handleCreateClinic(); }}>
          
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
               <span className={step === 1 ? "text-primary font-bold" : ""}>1. {t("step-1")}</span>
               <span>&gt;</span>
               <span className={step === 2 ? "text-primary font-bold" : ""}>2. {t("step-2")}</span>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>{t("first-name")}</Label>
                   <Input 
                      placeholder="Juan" 
                      required 
                      value={formData.firstName}
                      onChange={e => setFormData({...formData, firstName: e.target.value})}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>{t("last-name")}</Label>
                   <Input 
                      placeholder="García" 
                      required 
                      value={formData.lastName}
                      onChange={e => setFormData({...formData, lastName: e.target.value})}
                   />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 mt-4">
                 <div className="space-y-2">
                   <Label>{t("email")}</Label>
                   <Input 
                      value={formData.email} 
                      readOnly 
                      className="bg-muted text-muted-foreground"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>{t("phone")}</Label>
                   <Input 
                      placeholder="612 345 678" 
                      required 
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                   />
                 </div>
               </div>

               <div className="space-y-2 mt-4">
                  <Label>{t("clinic-name")}</Label>
                  <Input 
                    placeholder="Clínica Dental García" 
                    required 
                    value={formData.clinicName}
                    onChange={e => setFormData({...formData, clinicName: e.target.value})}
                  />
               </div>
            </div>
            )}

            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                
                <div className="space-y-3">
                  <Label>{t("clinic-size")}</Label>
                  <RadioGroup 
                    defaultValue="1-2" 
                    value={formData.clinicSize}
                    onValueChange={(val) => setFormData({...formData, clinicSize: val})}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="1-2" id="s1" className="peer sr-only" />
                      <Label
                        htmlFor="s1"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                      >
                        {t("size-1-2")}
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="3-5" id="s2" className="peer sr-only" />
                      <Label
                        htmlFor="s2"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                      >
                        {t("size-3-5")}
                      </Label>
                    </div>
                     <div>
                      <RadioGroupItem value="6-plus" id="s3" className="peer sr-only" />
                      <Label
                        htmlFor="s3"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                      >
                        {t("size-6-plus")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>{t("software-current")}</Label>
                  <Select 
                    value={formData.currentSoftware} 
                    onValueChange={(val) => setFormData({...formData, currentSoftware: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("software-placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguno / Papel</SelectItem>
                      <SelectItem value="dentadesk">Dentadesk</SelectItem>
                      <SelectItem value="softdent">Softdent</SelectItem>
                      <SelectItem value="dentalink">Dentalink</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("additional-info")}</Label>
                  <Textarea 
                    placeholder={t("additional-info-placeholder")}
                    className="h-24"
                    value={formData.additionalInfo}
                    onChange={e => setFormData({...formData, additionalInfo: e.target.value})}
                  />
                </div>
              </div>
            )}

          </CardContent>
          
          <CardFooter className="flex justify-between">
             {step === 2 ? (
                <Button variant="outline" type="button" onClick={prevStep} disabled={loading}>
                  {t("back")}
                </Button>
             ) : (
               <div /> // Spacer
             )}

             {step === 1 ? (
               <Button type="submit">{t("next-step")}</Button>
             ) : (
               <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white" disabled={loading}>
                 {loading ? t("saving") : t("start-trial")}
               </Button>
             )}
          </CardFooter>
        </form>
      </Card>
      
      {/* Test Helper for User */}
      <div className="mt-4 text-center text-xs text-muted-foreground">
        Current User Email will be auto-filled if logged in.
      </div>
    </div>
  )
}
