"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/components/translations"
import { PageHeader } from "@/components/page-header"
import { Settings, Bell, Shield, Database, Save, Sun, Moon, Monitor, Users, UserPlus, RefreshCw } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

import { useTheme } from "next-themes"
import { useAuth } from "@/components/auth-context"
import { APP_CONFIG } from "@/lib/constants"
import { supabase } from "@/lib/supabase"

export default function SettingsPage() {
  const { t, language, setLanguage } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const [generalSettings, setGeneralSettings] = useState({
    language: language,
    theme: theme || "system",
    timeZone: APP_CONFIG.timezone,
    dateFormat: "dd/mm/yyyy",
  })

  // Team Settings State
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [isInviteLoading, setIsInviteLoading] = useState(false)
  const [inviteData, setInviteData] = useState({
    email: "",
    fullName: "",
    role: "doctor"
  })

  // Fetch team members on mount
  React.useEffect(() => {
    fetchTeamMembers()
  }, [])

  const fetchTeamMembers = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get current user's clinic_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id')
      .eq('id', user.id)
      .single()

    if (profile?.clinic_id) {
       const { data: members } = await supabase
         .from('profiles')
         .select('*')
         .eq('clinic_id', profile.clinic_id)
       
       if (members) setTeamMembers(members)
    }
  }

  const handleInviteUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviteLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('invite-team-member', {
        body: inviteData
      })

      if (error) throw error

      toast.success(`${t("invite-sent")} ${inviteData.email}`)
      setInviteData({ email: "", fullName: "", role: "doctor" })
      fetchTeamMembers() // Refresh list (though invite is pending, but maybe we want to see it if logic allows)
    } catch (error: any) {
      toast.error(error.message || "Error inviting user")
    } finally {
      setIsInviteLoading(false)
    }
  }

  // Update local state when theme changes externally
  // useEffect(() => {
  //   setGeneralSettings(prev => ({ ...prev, theme: theme || "system" }))
  // }, [theme])

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    appointmentReminders: true,
  })

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: "30",
  })

  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    backupFrequency: "daily",
    backupLocation: "cloud",
  })

  const handleGeneralSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLanguage(generalSettings.language as "es" | "en")
    // Theme is already updated via onValueChange
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  const handleNotificationSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  const handleSecuritySettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  const handleBackupSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }



  return (
    <div className="space-y-6">
      <PageHeader title={t("settings")} />

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("general-settings")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t("notification-settings")}
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("security-settings")}
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            {t("backup-settings")}
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("team-settings")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t("general-settings")}</CardTitle>
              <CardDescription>{t("general-settings-description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGeneralSettingsSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">{t("language")}</Label>
                    <Select
                      value={generalSettings.language}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, language: value as "es" | "en" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 md:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">{t("theme")}</Label>
                        <p className="text-sm text-muted-foreground">
                          {language === "es" ? "Selecciona tu tema preferido" : "Select your preferred theme"}
                        </p>
                      </div>
                    </div>
                    
                    {/* Premium Toggle Switch Design */}
                    <div className="relative inline-flex items-center p-1 bg-muted/50 rounded-2xl border shadow-inner">
                      {/* Sliding Background Indicator */}
                      <div 
                        className={`absolute h-[calc(100%-8px)] rounded-xl bg-background shadow-md transition-all duration-300 ease-out ${
                          theme === "light" ? "w-[calc(33.333%-4px)] left-1" :
                          theme === "dark" ? "w-[calc(33.333%-4px)] left-[calc(33.333%+2px)]" :
                          "w-[calc(33.333%-4px)] left-[calc(66.666%+3px)]"
                        }`}
                      />
                      
                      {/* Light Mode Button */}
                      <button
                        onClick={() => {
                          setTheme("light")
                          setGeneralSettings({ ...generalSettings, theme: "light" })
                        }}
                        className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 ${
                          theme === "light" 
                            ? "text-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Sun className={`h-4 w-4 transition-colors ${
                          theme === "light" ? "text-orange-500" : ""
                        }`} />
                        <span className="text-sm font-medium whitespace-nowrap">
                          {language === "es" ? "Claro" : "Light"}
                        </span>
                      </button>

                      {/* Dark Mode Button */}
                      <button
                        onClick={() => {
                          setTheme("dark")
                          setGeneralSettings({ ...generalSettings, theme: "dark" })
                        }}
                        className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 ${
                          theme === "dark" 
                            ? "text-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Moon className={`h-4 w-4 transition-colors ${
                          theme === "dark" ? "text-blue-500" : ""
                        }`} />
                        <span className="text-sm font-medium whitespace-nowrap">
                          {language === "es" ? "Oscuro" : "Dark"}
                        </span>
                      </button>

                      {/* System Mode Button */}
                      <button
                        onClick={() => {
                          setTheme("system")
                          setGeneralSettings({ ...generalSettings, theme: "system" })
                        }}
                        className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 ${
                          theme === "system" 
                            ? "text-foreground" 
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Monitor className={`h-4 w-4 transition-colors ${
                          theme === "system" ? "text-primary" : ""
                        }`} />
                        <span className="text-sm font-medium whitespace-nowrap">
                          {language === "es" ? "Sistema" : "System"}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">{t("time-zone")}</Label>
                    <Select
                      value={generalSettings.timeZone}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, timeZone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Guayaquil">{language === "es" ? "Guayaquil" : "Guayaquil"} (GMT-5)</SelectItem>
                        <SelectItem value="Europe/Madrid">{language === "es" ? "Madrid" : "Madrid"} (GMT+1)</SelectItem>
                        <SelectItem value="Europe/London">{language === "es" ? "Londres" : "London"} (GMT+0)</SelectItem>
                        <SelectItem value="America/New_York">{language === "es" ? "Nueva York" : "New York"} (GMT-5)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateformat">{t("date-format")}</Label>
                    <Select
                      value={generalSettings.dateFormat}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, dateFormat: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                        <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                        <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? t("saving") : t("save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t("notification-settings")}</CardTitle>
              <CardDescription>{t("notification-settings-description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNotificationSettingsSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("email-notifications")}</Label>
                      <p className="text-sm text-muted-foreground">{t("email-notifications-description")}</p>
                    </div>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("push-notifications")}</Label>
                      <p className="text-sm text-muted-foreground">{t("push-notifications-description")}</p>
                    </div>
                    <Switch
                      checked={notificationSettings.pushNotifications}
                      onCheckedChange={async (checked) => {
                        if (checked) {
                           const permission = await Notification.requestPermission()
                           if (permission !== 'granted') {
                               alert("Permiso denegado para notificaciones. Por favor habilita las notificaciones en tu navegador.")
                               setNotificationSettings({ ...notificationSettings, pushNotifications: false })
                               return
                           }
                        }
                        setNotificationSettings({ ...notificationSettings, pushNotifications: checked })
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("sms-notifications")}</Label>
                      <p className="text-sm text-muted-foreground">{t("sms-notifications-description")}</p>
                    </div>
                    <Switch
                      checked={notificationSettings.smsNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({ ...notificationSettings, smsNotifications: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("appointment-reminders")}</Label>
                      <p className="text-sm text-muted-foreground">{t("appointment-reminders-description")}</p>
                    </div>
                    <Switch
                      checked={notificationSettings.appointmentReminders}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({ ...notificationSettings, appointmentReminders: checked })
                      }
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? t("saving") : t("save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>{t("security-settings")}</CardTitle>
              <CardDescription>{t("security-settings-description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSecuritySettingsSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("two-factor-auth")}</Label>
                      <p className="text-sm text-muted-foreground">{t("two-factor-auth-description")}</p>
                    </div>
                    <Switch
                      checked={securitySettings.twoFactorAuth}
                      onCheckedChange={(checked) =>
                        setSecuritySettings({ ...securitySettings, twoFactorAuth: checked })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">{t("session-timeout")} ({language === "es" ? "minutos" : "minutes"})</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value })}
                      className="max-w-xs"
                    />
                    <p className="text-sm text-muted-foreground">
                      {t("session-timeout-description")}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? t("saving") : t("save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle>{t("backup-settings")}</CardTitle>
              <CardDescription>{t("backup-settings-description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBackupSettingsSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("auto-backup")}</Label>
                      <p className="text-sm text-muted-foreground">{t("auto-backup-description")}</p>
                    </div>
                    <Switch
                      checked={backupSettings.autoBackup}
                      onCheckedChange={(checked) => setBackupSettings({ ...backupSettings, autoBackup: checked })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup-frequency">{t("backup-frequency")}</Label>
                    <Select
                      value={backupSettings.backupFrequency}
                      onValueChange={(value) => setBackupSettings({ ...backupSettings, backupFrequency: value })}
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">{language === "es" ? "Cada hora" : "Hourly"}</SelectItem>
                        <SelectItem value="daily">{language === "es" ? "Diario" : "Daily"}</SelectItem>
                        <SelectItem value="weekly">{language === "es" ? "Semanal" : "Weekly"}</SelectItem>
                        <SelectItem value="monthly">{language === "es" ? "Mensual" : "Monthly"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup-location">{t("backup-location")}</Label>
                    <Select
                      value={backupSettings.backupLocation}
                      onValueChange={(value) => setBackupSettings({ ...backupSettings, backupLocation: value })}
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cloud">{language === "es" ? "Nube" : "Cloud"}</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="both">{language === "es" ? "Ambos" : "Both"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" type="button">
                    {t("create-backup-now")}
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? t("saving") : t("save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <div className="grid gap-6">
            {/* Invite Form */}
            <Card>
              <CardHeader>
                <CardTitle>{t("invite-member")}</CardTitle>
                <CardDescription>{t("team-settings-description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInviteUserSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{t("email")}</Label>
                      <Input 
                        placeholder={t("email-placeholder")}
                        type="email" 
                        required
                        value={inviteData.email}
                        onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                       <Label>{t("full-name")}</Label>
                       <Input 
                        placeholder={t("name-placeholder")}
                        required
                        value={inviteData.fullName}
                        onChange={(e) => setInviteData({...inviteData, fullName: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("role")}</Label>
                      <Select 
                        value={inviteData.role}
                        onValueChange={(val) => setInviteData({...inviteData, role: val})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="doctor">{t("doctor")}</SelectItem>
                          <SelectItem value="receptionist">{t("reception")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isInviteLoading}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {isInviteLoading ? t("inviting") : t("invite")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Team List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t("member-list")}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={fetchTeamMembers}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("full-name")}</TableHead>
                      <TableHead>{t("email")}</TableHead>
                      <TableHead>{t("role")}</TableHead>
                      <TableHead className="text-right">{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.full_name}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {member.role === 'clinic_owner' ? t("admin") : 
                             member.role === 'receptionist' ? t("reception") : t("doctor")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                             {t("edit")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {teamMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No members found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
