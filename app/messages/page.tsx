"use client"

import { useState, useEffect, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Search, User, Phone, Mail, MoreVertical } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  sender?: {
    full_name: string
    avatar_url: string
  }
}

interface Profile {
  id: string
  full_name: string
  avatar_url: string
  role: string
}

export default function MessagesPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [users, setUsers] = useState<Profile[]>([])
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchUsers()
  }, [user])

  // Handle URL query parameters for direct messaging
  useEffect(() => {
    // We need to parse the search params from the URL manually or use useSearchParams
    // Since this is a client component, we can use window.location or useSearchParams hook
    const params = new URLSearchParams(window.location.search)
    const userId = params.get('userId')
    
    if (userId && users.length > 0) {
      const targetUser = users.find(u => u.id === userId)
      if (targetUser) {
        setSelectedUser(targetUser)
      }
    }
  }, [users, user])

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id)
      
      // Subscribe to new messages
      const channel = supabase
        .channel('public:messages')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `receiver_id=eq.${user?.id}` 
        }, (payload) => {
          if (payload.new.sender_id === selectedUser.id) {
             fetchMessages(selectedUser.id)
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedUser, user])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id) // Exclude self

      if (error) throw error
      if (data) setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchMessages = async (otherUserId?: string) => {
    if (!otherUserId || !user) return

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(full_name, avatar_url)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })

      if (error) throw error
      if (data) setMessages(data)
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !user) return

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          content: newMessage,
          sender_id: user.id,
          receiver_id: selectedUser.id,
        })

      if (error) throw error

      setNewMessage("")
      fetchMessages(selectedUser.id) // Refresh immediately
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
      <PageHeader title="Mensajes" />
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full">
        {/* Users List */}
        <Card className="md:col-span-1 h-full flex flex-col">
          <CardHeader className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar usuarios..." className="pl-8" />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="flex flex-col">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left ${
                      selectedUser?.id === u.id ? "bg-muted" : ""
                    }`}
                  >
                    <Avatar>
                      <AvatarImage src={u.avatar_url || ""} />
                      <AvatarFallback>{u.full_name?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium truncate">{u.full_name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{u.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="md:col-span-3 h-full flex flex-col">
          {selectedUser ? (
            <>
              <CardHeader className="p-4 border-b flex flex-row items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedUser.avatar_url || ""} />
                  <AvatarFallback>{selectedUser.full_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-base">{selectedUser.full_name}</CardTitle>
                  <div className="text-xs text-muted-foreground capitalize">{selectedUser.role}</div>
                </div>
                <div className="flex gap-1">
                   <Button variant="ghost" size="icon"><Phone className="h-4 w-4"/></Button>
                   <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
                <div className="flex-1 overflow-y-auto space-y-4 pr-2" ref={scrollRef}>
                    {messages.map((msg) => {
                      const isMe = msg.sender_id === user?.id
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              isMe
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm">{msg.content}</p>
                            <span className="text-[10px] opacity-70 mt-1 block text-right">
                              {format(new Date(msg.created_at), "h:mm a", { locale: es })}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>

                <div className="flex gap-2 mt-auto pt-2">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-2">
              <User className="h-12 w-12 opacity-20" />
              <p>Selecciona un usuario para comenzar a chatear</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
