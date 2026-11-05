import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { GiftCategory, GiftItem } from '../types';
import { X, Send, Coins, Users, Sparkles, Crown } from 'lucide-react';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GiftModal: React.FC<GiftModalProps> = ({ isOpen, onClose }) => {
  const { gifts, activeRoom, currentUser, sendGift, setActiveModal } = useApp();

  const [activeTab, setActiveTab] = useState<GiftCategory>('classic');
  const [selectedGiftId, setSelectedGiftId] = useState<string>(gifts[0]?.id || 'gift_rose');
  const [comboCount, setComboCount] = useState<number>(1);
  const [targetType, setTargetType] = useState<'speaker' | 'seat' | 'all'>('speaker');
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number>(0);

  if (!isOpen || !activeRoom) return null;

  const filteredGifts = gifts.filter((g) => g.category === activeTab);
  const selectedGift = gifts.find((g) => g.id === selectedGiftId) || gifts[0];

  const combos = [1, 10, 66, 188, 520, 1314];

  // Calculate target recipient count
  let targetCount = 1;
  if (targetType === 'all') {
    const activeSeats = activeRoom.seats.filter((s) => s.userId);
    targetCount = Math.max(1, activeSeats.length);
  }

  const totalCoinsNeeded = selectedGift ? selectedGift.coinPrice * comboCount * targetCount : 0;
  const hasEnoughCoins = currentUser.coins >= totalCoinsNeeded;

  const handleSend = () => {
    if (!selectedGift) return;
    const success = sendGift(selectedGift.id, comboCount, targetType, selectedSeatIndex);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-2xl bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">مركز إرسال الهدايا</h3>
              <p className="text-[11px] text-slate-400">ادعم المضيفين واشعل أجواء الغرفة بأقوى المؤثرات</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Balance */}
            <div 
              onClick={() => setActiveModal('wallet')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold cursor-pointer hover:bg-slate-700"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentUser.coins.toLocaleString()}</span>
              <span className="text-[10px] text-amber-400/80">شحن +</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 overflow-x-auto no-scrollbar">
          {[
            { id: 'classic', label: 'كلاسيكية 🌹' },
            { id: 'luxury', label: 'فاخرة 🏎️' },
            { id: 'romantic', label: 'رومانسية 💖' },
            { id: 'magic', label: 'سحرية SVGA 🏰' },
            { id: 'vip', label: 'حصري VIP 👑' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id as GiftCategory)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === cat.id
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Gift Grid */}
        <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-2.5 overflow-y-auto max-h-72">
          {filteredGifts.map((gift) => {
            const isSelected = selectedGiftId === gift.id;
            const isVipLocked = gift.vipMinLevel && currentUser.vipLevel < gift.vipMinLevel;

            return (
              <div
                key={gift.id}
                onClick={() => {
                  if (isVipLocked) {
                    alert(`هذه الهدية تتطلب عضوية VIP ${gift.vipMinLevel} فما فوق! يمكنك الترقية من مركز VIP.`);
                    return;
                  }
                  setSelectedGiftId(gift.id);
                }}
                className={`relative p-3 rounded-2xl flex flex-col items-center justify-between text-center cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10 scale-[1.02]'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                } ${isVipLocked ? 'opacity-60 grayscale-[40%]' : ''}`}
              >
                {/* VIP badge requirement */}
                {gift.vipMinLevel && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[9px]">
                    VIP {gift.vipMinLevel}
                  </span>
                )}

                <div className="text-3xl sm:text-4xl my-1 transform group-hover:scale-110 transition-transform">
                  {gift.icon}
                </div>

                <div className="text-xs font-bold text-slate-200 truncate w-full mt-1">
                  {gift.nameAr}
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono text-amber-400 font-bold mt-1">
                  <Coins className="w-3 h-3" />
                  <span>{gift.coinPrice.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recipient & Combo Controls */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col gap-3">
          
          {/* Target Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-medium">المستلم:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTargetType('speaker')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  targetType === 'speaker'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                المتحدث الحالي
              </button>

              <button
                onClick={() => setTargetType('all')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                  targetType === 'all'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>الكل في المايك ({targetCount})</span>
              </button>

              {/* Specific seat dropdown */}
              <select
                value={selectedSeatIndex}
                onChange={(e) => {
                  setTargetType('seat');
                  setSelectedSeatIndex(Number(e.target.value));
                }}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-amber-500"
              >
                {activeRoom.seats.map((seat, i) => (
                  <option key={i} value={i}>
                    المقعد {i + 1} {seat.userName ? `(${seat.userName})` : '(فارغ)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Combos Pill Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 font-medium">الكمية (كومبو):</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {combos.map((c) => (
                <button
                  key={c}
                  onClick={() => setComboCount(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    comboCount === c
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 scale-105'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  x{c}
                </button>
              ))}
            </div>
          </div>

          {/* Total & Send Action */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
            <div>
              <div className="text-[11px] text-slate-400">إجمالي التكلفة:</div>
              <div className="flex items-center gap-1.5 text-base sm:text-lg font-mono font-bold text-amber-300">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>{totalCoinsNeeded.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-normal">عملة</span>
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={!hasEnoughCoins}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-xl transition-all ${
                hasEnoughCoins
                  ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 text-white hover:opacity-95 active:scale-95 shadow-amber-500/25'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4 rtl:rotate-180" />
              <span>{hasEnoughCoins ? 'إرسال الهدية الآن' : 'الرصيد غير كافٍ'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
