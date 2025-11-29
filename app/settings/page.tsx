"use client"

import type React from "react"

import { useState } from "react"
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
import { Settings, Bell, Shield, Database, Save } from "lucide-react"

export default function SettingsPage() {
  const { t, language, setLanguage } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)

  const [generalSettings, setGeneralSettings] = useState({
    language: language,
    theme: "system",
    timeZone: "Europe/Madrid",
    dateFormat: "dd/mm/yyyy",
  })

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
                  <div className="space-y-2">
                    <Label htmlFor="theme">{t("theme")}</Label>
                    <Select
                      value={generalSettings.theme}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, theme: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">{language === "es" ? "Claro" : "Light"}</SelectItem>
                        <SelectItem value="dark">{language === "es" ? "Oscuro" : "Dark"}</SelectItem>
                        <SelectItem value="system">{language === "es" ? "Sistema" : "System"}</SelectItem>
                      </SelectContent>
                    </Select>
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
                      onCheckedChange={(checked) =>
                        setNotificationSettings({ ...notificationSettings, pushNotifications: checked })
                      }
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
      </Tabs>
    </div>
  )
}
