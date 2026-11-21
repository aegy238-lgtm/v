import React from 'react';
import { useApp } from '../context/AppContext';
import { Home, Gamepad2, MessageSquare, User as UserIcon } from 'lucide-react';

export const BottomNavBar: React.FC = () => {
  const { activeTab, setActiveTab, transactions, currentUser } = useApp();

  const recentAlertCount = Math.min(
    99,
    transactions.filter((tx) => tx.userId === currentUser.id).length
  );

  const navItems = [
    { id: 'room' as const, label: 'الغرف', icon: Home },
    { id: 'game' as const, label: 'الألعاب', icon: Gamepad2 },
    {
      id: 'chat' as const,
      label: 'المحادثات',
      icon: MessageSquare,
      badge: recentAlertCount > 0 ? recentAlertCount : undefined,
    },
    { id: 'me' as const, label: 'ملفي', icon: UserIcon },
  ];

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed bottom-0 inset-x-0 md:bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-40 bg-[#0d1220]/95 backdrop-blur-xl border-t md:border border-white/12 md:rounded-2xl px-4 py-2 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.55)] md:shadow-[0_18px_50px_rgba(0,0,0,0.7)] font-tajawal"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`relative min-w-[64px] min-h-[46px] px-3 py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${
              isActive
                ? 'text-amber-300 bg-amber-400/12 border border-amber-400/30 shadow-[0_0_20px_rgba(245,158,11,0.16)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
            }`}
            title={item.label}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.9]'}`} />
            <span className={`text-[11px] leading-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
              {item.label}
            </span>

            {item.badge !== undefined && (
              <span className="absolute top-1 left-2 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white font-mono tabular-nums font-bold text-[10px] flex items-center justify-center shadow">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
