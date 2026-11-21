import React from 'react';
import { useApp } from '../context/AppContext';
import { Crown, Sparkles } from 'lucide-react';

export const GlobalJackpotBanner: React.FC = () => {
  const { globalJackpotBanner } = useApp();

  if (!globalJackpotBanner) return null;

  return (
    <div
      key={globalJackpotBanner.id}
      className="fixed top-3 inset-x-3 z-[120] pointer-events-none flex justify-center animate-jackpot-bar font-tajawal"
      role="status"
      aria-live="polite"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-gradient-to-l from-[#2b1705]/95 via-[#432307]/95 to-[#1f1005]/95 border border-amber-300/75 shadow-[0_12px_40px_rgba(245,158,11,0.45)] backdrop-blur-md px-3.5 py-2.5">
        {/* Subtle Gold Sheen Sweep */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/15 to-transparent animate-jackpot-sweep pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          {/* Winner Avatar & Crown */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative">
              <img
                src={globalJackpotBanner.winnerAvatar}
                alt={globalJackpotBanner.winnerName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border-2 border-amber-300 shadow"
              />
              <span className="absolute -top-1.5 -right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                <Crown className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Scrolling / Highlighted Jackpot Text */}
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-200/90 font-semibold truncate">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">
                تهانينا {globalJackpotBanner.winnerName} · {globalJackpotBanner.roomTitle}
              </span>
            </div>
            <div className="text-xs sm:text-sm font-black text-white leading-snug mt-0.5 truncate">
              لقد ربحت مبلغ{' '}
              <span className="font-mono tabular-nums text-amber-300 mx-0.5">
                {globalJackpotBanner.amountWon.toLocaleString('en-US')}
              </span>{' '}
              عملة في الحظ! 🎉
            </div>
          </div>

          {/* Gift Visual + Multiplier */}
          <div className="flex items-center gap-2 shrink-0 bg-black/35 border border-amber-300/35 rounded-xl px-2.5 py-1.5">
            {globalJackpotBanner.giftImageUrl ? (
              <img
                src={globalJackpotBanner.giftImageUrl}
                alt={globalJackpotBanner.giftName}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-lg object-cover"
              />
            ) : (
              <span className="text-2xl leading-none">{globalJackpotBanner.giftIcon}</span>
            )}
            <div className="text-left leading-none">
              <span className="block text-[9px] text-amber-200/80">الحظ</span>
              <span className="font-mono tabular-nums text-xs font-black text-amber-300">
                {globalJackpotBanner.multiplier}X
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
