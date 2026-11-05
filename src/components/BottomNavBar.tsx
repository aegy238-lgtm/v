import React from 'react';
import { useApp } from '../context/AppContext';

export const BottomNavBar: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 py-2.5 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
      
      {/* 1. Profile (Leftmost in RTL layout as shown in video 00:34-00:47) */}
      <button
        onClick={() => setActiveTab('me')}
        className={`relative p-1.5 transition-transform active:scale-90 ${
          activeTab === 'me' ? 'text-teal-500 scale-110' : 'text-slate-400 hover:text-slate-600'
        }`}
        title="ملفي"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {/* 2. Chat / Messages (With red badge "3" as shown in video 00:35-00:47) */}
      <button
        onClick={() => setActiveTab('chat')}
        className={`relative p-1.5 transition-transform active:scale-90 ${
          activeTab === 'chat' ? 'text-teal-500 scale-110' : 'text-slate-400 hover:text-slate-600'
        }`}
        title="محادثة"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="9" y1="10" x2="15" y2="10" />
        </svg>
        <span className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
          3
        </span>
      </button>

      {/* 3. Moments / Games Circle Icon */}
      <button
        onClick={() => setActiveTab('game')}
        className={`relative p-1.5 transition-transform active:scale-90 ${
          activeTab === 'game' ? 'text-teal-500 scale-110' : 'text-slate-400 hover:text-slate-600'
        }`}
        title="لحظات وألعاب"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3.5" fill={activeTab === 'game' ? 'currentColor' : 'none'} />
        </svg>
      </button>

      {/* 4. Home / Rooms (Rightmost in RTL layout as shown in video 00:42-00:47) */}
      <button
        onClick={() => setActiveTab('room')}
        className={`relative p-1.5 transition-transform active:scale-90 ${
          activeTab === 'room' ? 'text-teal-500 scale-110' : 'text-slate-400 hover:text-slate-600'
        }`}
        title="الرئيسية"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill={activeTab === 'room' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        </svg>
      </button>

    </div>
  );
};
