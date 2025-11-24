import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Send, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Socket } from 'socket.io-client';
import { getAvatarUrl } from '@/lib/avatarUtils';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  isOwn: boolean;
}

interface MeetingChatProps {
  socket: Socket | null;
  meetingId: string;
  isOpen: boolean;
  onToggle: () => void;
}

export default function MeetingChat({ socket, meetingId, isOpen, onToggle }: MeetingChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for chat messages
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (data: { userId: string; userName: string; message: string; timestamp?: string }) => {
      // Prevent duplicate messages by checking if we already have this message
      // (in case server echoes back our own message)
      setMessages(prev => {
        const isDuplicate = prev.some(
          msg => msg.userId === data.userId && 
                 msg.message === data.message && 
                 Math.abs(new Date(data.timestamp || Date.now()).getTime() - msg.timestamp.getTime()) < 2000
        );
        
        if (isDuplicate) {
          return prev; // Don't add duplicate
        }
        
        const newMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          userId: data.userId,
          userName: data.userName,
          message: data.message,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          isOwn: data.userId === user?.id
        };
        
        return [...prev, newMessage];
      });
    };

    socket.on('chat-message', handleChatMessage);

    return () => {
      socket.off('chat-message', handleChatMessage);
    };
  }, [socket, user?.id]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket || !user || !user.id) return;

    const messageData = {
      meetingId,
      userId: user.id,
      userName: user.name || user.email || 'Unknown',
      message: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    // Emit chat message to server
    socket.emit('chat-message', messageData);

    // Add message to local state immediately for instant feedback
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      userId: user.id,
      userName: user.name || user.email || 'Unknown',
      message: inputMessage.trim(),
      timestamp: new Date(),
      isOwn: true
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={onToggle}
        className="fixed bottom-20 right-4 z-50 rounded-full w-14 h-14 shadow-lg"
        size="icon"
        variant="default"
      >
        <MessageSquare className="h-5 w-5" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {messages.length}
          </span>
        )}
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-20 right-4 w-80 h-96 z-50 flex flex-col shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Chat
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-6 w-6"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50"
        >
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 text-sm mt-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-2 ${msg.isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={getAvatarUrl(undefined, msg.userName)} />
                  <AvatarFallback className="text-xs bg-blue-600 text-white">
                    {msg.userName ? msg.userName.split(' ').map(n => n[0]).join('').slice(0, 2) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    msg.isOwn
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  {!msg.isOwn && (
                    <div className="text-xs font-semibold mb-1 opacity-80">
                      {msg.userName}
                    </div>
                  )}
                  <div className="text-sm break-words">{msg.message}</div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.isOwn ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSendMessage} className="border-t p-2 bg-white">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              disabled={!socket}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputMessage.trim() || !socket}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

