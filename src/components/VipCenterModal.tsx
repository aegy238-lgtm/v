import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Crown,
  Check,
  X,
  Coins,
  Sparkles,
  ShieldCheck,
  Flame,
  Zap,
  Gift,
  Star,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface VipCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VipCenterModal: React.FC<VipCenterModalProps> = ({ isOpen, onClose }) => {
  const { vipTiers, currentUser, purchaseVip, rechargeCoins, setActiveModal } = useApp();

  const [selectedVipLevel, setSelectedVipLevel] = useState<number>(
    currentUser.vipLevel > 0 ? currentUser.vipLevel : 4
  );
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [previewEntrance, setPreviewEntrance] = useState(false);

  if (!isOpen) return null;

  const currentTier = vipTiers.find((v) => v.level === selectedVipLevel) || vipTiers[0];

  const discountMultiplier = durationMonths === 3 ? 0.9 : durationMonths === 12 ? 0.75 : 1.0;
  const totalCost = Math.round(currentTier.coinCostMonthly * durationMonths * discountMultiplier);
  const hasEnoughCoins = currentUser.coins >= totalCost;

  const handleSubscribe = () => {
    if (!hasEnoughCoins) {
      // Top up helper so the user can test any VIP level immediately
      rechargeCoins(totalCost, 'VIP Instant Upgrade Bonus');
    }
    const success = purchaseVip(currentTier.level, durationMonths);
    if (success) {
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
      onClose();
    }
  };

  const privilegedGrid = [
    { icon: '👑', title: 'تاج وإطار 3D ملكي', desc: `إطار ${currentTier.nameAr} المضيء في جميع الغرف` },
    { icon: currentTier.entranceIcon, title: 'دخولية أسطورية', desc: currentTier.entranceName },
    { icon: '🍭', title: 'مضاعف هدايا الحظ', desc: `زيادة نسبة ربح 66X و 188X بنسبة +${currentTier.level * 5}%` },
    { icon: '🛡️', title: 'حصانة ضد الطرد والكتم', desc: 'حماية كاملة داخل الغرف الصوتية العامة' },
    { icon: '💬', title: 'فقاعة دردشة ذهبية', desc: 'رسائلك تظهر بلون ذهبي مشع في شات الغرفة' },
    { icon: '⚡', title: 'تسريع خبرة الحساب', desc: `+${currentTier.level * 10}% نقاط خبرة إضافية عند إرسال الهدايا` },
    { icon: '🕵️', title: 'دخول متخفي للغرف', desc: 'إمكانية تصفح الغرف والملفات بدون ظهور في الزوار' },
    { icon: '🎁', title: 'صندوق هدايا VIP يومي', desc: `${currentTier.level * 1500} كوينزات هدية مجانية يومياً` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-tajawal select-none">
      <div className="w-full max-w-md bg-gradient-to-b from-[#1a130c] via-[#120d08] to-[#0c0805] border-2 border-amber-500/60 rounded-[32px] shadow-[0_0_50px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col max-h-[92vh] text-white">
        
        {/* Top Royal Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-amber-950/90 via-stone-900 to-amber-950/90 border-b border-amber-500/30 flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 text-stone-300 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-base font-black bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-300 bg-clip-text text-transparent">
              مركز امتيازات VIP الملكي
            </span>
            <span className="text-xl">💎</span>
          </div>

          <button
            onClick={() => {
              onClose();
              setActiveModal('wallet');
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-mono font-bold"
          >
            <span>{currentUser.coins.toLocaleString()}</span>
            <span>🪙</span>
          </button>
        </div>

        {/* Horizontal VIP 1 - 15 Selector */}
        <div className="px-3 py-2.5 bg-black/60 border-b border-amber-500/20 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {vipTiers.map((tier) => {
            const isSelected = selectedVipLevel === tier.level;
            const isUnlocked = currentUser.vipLevel >= tier.level;

            return (
              <button
                key={tier.level}
                onClick={() => setSelectedVipLevel(tier.level)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.6)] scale-105'
                    : isUnlocked
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-white/5 text-stone-400 border border-white/10'
                }`}
              >
                <span>{tier.badgeIcon}</span>
                <span>VIP {tier.level}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* 3D Animated Emblem Card */}
          <div className="relative rounded-3xl p-5 bg-gradient-to-br from-amber-900/40 via-[#1f150b] to-amber-950/60 border-2 border-amber-400/70 shadow-2xl overflow-hidden flex flex-col items-center text-center">
            <div className="absolute -top-12 inset-x-0 h-28 bg-amber-400/20 blur-2xl pointer-events-none" />

            {/* Live Entrance Preview Overlay */}
            {previewEntrance && (
              <div className="mb-3 w-full py-2 px-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 animate-bounce shadow-lg">
                <span className="text-xl">{currentTier.entranceIcon}</span>
                <span>
                  وصل الآن {currentUser.displayName} على متن {currentTier.entranceName}!
                </span>
              </div>
            )}

            {/* 3D Crest + User Avatar */}
            <div className="relative w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-yellow-200 to-amber-600 shadow-[0_0_30px_rgba(245,158,11,0.7)] flex items-center justify-center mb-3">
              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                className="w-full h-full rounded-full object-cover border-2 border-slate-950"
              />
              <span className="absolute -top-3 text-2xl drop-shadow">👑</span>
              <span className="absolute -bottom-2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-xs border border-white shadow">
                VIP {currentTier.level}
              </span>
            </div>

            <h3 className="text-lg font-black text-amber-300 mt-1">{currentTier.nameAr}</h3>
            <p className="text-xs text-stone-300 mt-0.5">
              الدخولية الملكية: <span className="text-yellow-300 font-bold">{currentTier.entranceName} {currentTier.entranceIcon}</span>
            </p>

            <button
              onClick={() => setPreviewEntrance(!previewEntrance)}
              className="mt-3 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-amber-300/40 text-amber-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>معاينة دخولية الغرفة الحية</span>
            </button>
          </div>

          {/* 8 3D VIP Privileges Grid */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-amber-300 text-right px-1">
              المزايا الحصرية لعضوية VIP {currentTier.level} ({privilegedGrid.length} امتيازات)
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              {privilegedGrid.map((perk, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-3 bg-white/5 border border-amber-500/25 flex items-start gap-2.5 text-right"
                >
                  <div className="flex-1">
                    <div className="text-xs font-black text-amber-200">{perk.title}</div>
                    <div className="text-[10px] text-stone-400 leading-snug mt-0.5">{perk.desc}</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-lg shrink-0">
                    {perk.icon}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Duration Selector */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { m: 1, label: 'شهر واحد', tag: 'عادي' },
              { m: 3, label: '3 أشهر', tag: 'خصم 10%' },
              { m: 12, label: 'سنة كاملة', tag: 'خصم 25%' },
            ].map((d) => (
              <button
                key={d.m}
                onClick={() => setDurationMonths(d.m)}
                className={`rounded-2xl p-2.5 border text-center transition-all ${
                  durationMonths === d.m
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-stone-400'
                }`}
              >
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                  {d.tag}
                </span>
                <div className="text-xs font-black mt-1">{d.label}</div>
              </button>
            ))}
          </div>

        </div>

        {/* Footer Subscribe Action */}
        <div className="p-3.5 bg-black/90 border-t border-amber-500/30 flex items-center justify-between gap-3">
          <button
            onClick={handleSubscribe}
            className="flex-1 py-3 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-sm shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:opacity-95 active:scale-95 transition-all"
          >
            تفعيل وترقية VIP {currentTier.level} فورا
          </button>

          <div className="text-right shrink-0">
            <div className="text-[10px] text-stone-400">التكلفة الإجمالية</div>
            <div className="text-sm font-black text-amber-400 font-mono">
              {totalCost.toLocaleString()} 🪙
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
