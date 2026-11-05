import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Send, Gift, MessageCircle, Smile, CheckCheck } from 'lucide-react';

interface MessagesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  isMe: boolean;
}

export const MessagesDrawer: React.FC<MessagesDrawerProps> = ({ isOpen, onClose }) => {
  const { users, currentUser } = useApp();

  const contacts = users.filter((u) => u.id !== currentUser.id);
  const [selectedContact, setSelectedContact] = useState(contacts[0] || users[1]);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      senderId: selectedContact?.id || '2',
      text: 'أهلاً بك يا فيصل! منور البث الصوتي اليوم ✨',
      time: '11:30',
      isMe: false,
    },
    {
      id: 'm2',
      senderId: currentUser.id,
      text: 'حياك الله، صوتك وجلستكم كانت في قمة الروعة 🎶',
      time: '11:32',
      isMe: true,
    },
  ]);

  const [inputVal, setInputVal] = useState('');

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const newM: Message = {
      id: `m_${Date.now()}`,
      senderId: currentUser.id,
      text: inputVal.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };

    setMessages((prev) => [...prev, newM]);
    setInputVal('');

    // Simulated reply after 1.5s
    setTimeout(() => {
      const reply: Message = {
        id: `m_${Date.now() + 1}`,
        senderId: selectedContact.id,
        text: 'يسعدني تواجدك دائماً في رومنا! أراك على المايك قريباً 🎙️',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: false,
      };
      setMessages((prev) => [...prev, reply]);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[85vh]">
        
        {/* Left Contacts List (on desktop) */}
        <div className="w-full md:w-72 bg-slate-950 border-b md:border-b-0 md:border-l border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-cyan-400" />
              <span>الرسائل الخاصة</span>
            </h3>
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {contacts.map((contact) => {
              const isSelected = selectedContact?.id === contact.id;
              return (
                <div
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={`p-2.5 rounded-2xl flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-600/20 border border-indigo-500/40' : 'hover:bg-slate-900'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={contact.avatar}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-400"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-slate-950" />
                  </div>
                  <div className="flex-1 truncate text-right">
                    <div className="font-bold text-xs text-slate-100 truncate flex items-center justify-between">
                      <span>{contact.displayName}</span>
                      <span className="text-[10px] text-amber-400">VIP {contact.vipLevel}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {contact.bio || 'محادثة خاصة'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Chat Pane */}
        <div className="flex-1 flex flex-col justify-between bg-slate-900">
          
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            {selectedContact && (
              <div className="flex items-center gap-3">
                <img
                  src={selectedContact.avatar}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400"
                />
                <div>
                  <h4 className="font-bold text-sm text-slate-100">{selectedContact.displayName}</h4>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>متصل الآن</span>
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="hidden md:block p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Stream */}
          <div className="p-4 overflow-y-auto space-y-3 flex-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs ${
                    m.isMe
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white font-medium rounded-br-none shadow-md'
                      : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                  }`}
                >
                  <p>{m.text}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-1 px-1">
                  <span>{m.time}</span>
                  {m.isMe && <CheckCheck className="w-3 h-3 text-cyan-400" />}
                </div>
              </div>
            ))}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="اكتب رسالة خاصة هنا..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="p-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors"
            >
              <Send className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};
