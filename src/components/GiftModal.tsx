import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { GiftCategory } from '../types';
import { X, Send, Coins, Users, Sparkles } from 'lucide-react';
import { SmartMediaView } from './SmartMediaView';
import { getMediaFormatLabel } from '../utils/mediaFormats';
import { preloadMediaAssets } from '../utils/apngEngine';
import { sound } from '../utils/audio';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GiftModal: React.FC<GiftModalProps> = ({ isOpen, onClose }) => {
  const { gifts, activeRoom, currentUser, sendGift, evaluateLuckyGiftWin, setActiveModal } =
    useApp();

  const [activeTab, setActiveTab] = useState<GiftCategory>('lucky');
  const [selectedGiftId, setSelectedGiftId] = useState<string>(gifts[0]?.id || 'gift_rose');
  const [comboCount, setComboCount] = useState<number>(1);
  const [targetType, setTargetType] = useState<'speaker' | 'seat' | 'all'>('speaker');
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number>(0);
  const [vipNotice, setVipNotice] = useState<string | null>(null);

  const occupiedSeats = activeRoom?.seats.filter((s) => Boolean(s.userId)) || [];
  const filteredGifts = gifts.filter((g) => g.category === activeTab);
  const selectedGift = gifts.find((g) => g.id === selectedGiftId) || gifts[0];

  useEffect(() => {
    if (!isOpen || !selectedGift) return;
    preloadMediaAssets([selectedGift.videoUrl, selectedGift.imageUrl]);
    if (selectedGift.soundUrl) {
      sound.preloadAudioUrl(selectedGift.soundUrl);
    }
  }, [isOpen, selectedGift]);

  if (!isOpen || !activeRoom) return null;

  const combos = [1, 10, 66, 188, 520, 1314];

  const targetCount =
    occupiedSeats.length === 0 ? 0 : targetType === 'all' ? occupiedSeats.length : 1;

  const totalCoinsNeeded = selectedGift ? selectedGift.coinPrice * comboCount * targetCount : 0;
  const hasEnoughCoins = targetCount > 0 && currentUser.coins >= totalCoinsNeeded;

  const handleSend = () => {
    if (!selectedGift) return;
    sound.unlockAudio();
    const success = sendGift(selectedGift.id, comboCount, targetType, selectedSeatIndex);
    if (success) {
      if (!selectedGift.videoUrl?.trim() && !selectedGift.imageUrl?.trim()) {
        sound.playGiftHitAudio(selectedGift.soundEffect, selectedGift.soundUrl);
      }
      const isLucky =
        selectedGift.isLucky ||
        selectedGift.category === 'lucky' ||
        selectedGift.animationType === 'lollipop_matrix';
      if (isLucky) {
        evaluateLuckyGiftWin(
          selectedGift,
          comboCount,
          comboCount,
          totalCoinsNeeded,
          activeRoom.title
        );
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 font-tajawal">
      <div className="w-full sm:max-w-2xl bg-[#0e1320] border border-white/12 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">مركز إرسال الهدايا</h3>
              <p className="text-[11px] text-slate-400">
                اختر هدية فاخرة أو هدية حظ واضغط إرسال
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActiveModal('wallet')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 border border-amber-400/35 text-amber-300 text-xs font-mono tabular-nums font-bold hover:bg-white/12"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentUser.coins.toLocaleString()}</span>
              <span className="text-[10px] text-amber-300">+</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/8 text-slate-300 hover:text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#090d17] border-b border-white/8 overflow-x-auto no-scrollbar">
          {[
            { id: 'lucky', label: 'هدايا الحظ 🍭' },
            { id: 'classic', label: 'كلاسيكية 🌹' },
            { id: 'luxury', label: 'فاخرة 🏎️' },
            { id: 'romantic', label: 'رومانسية 💖' },
            { id: 'magic', label: 'سحرية SVGA 🏰' },
            { id: 'vip', label: 'حصري VIP 👑' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id as GiftCategory)}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === cat.id
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-white/6 text-slate-400 hover:text-white hover:bg-white/10'
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
              <button
                type="button"
                key={gift.id}
                onClick={() => {
                  if (isVipLocked) {
                    setVipNotice(`هذه الهدية تتطلب عضوية VIP ${gift.vipMinLevel} فما فوق.`);
                    setTimeout(() => setVipNotice(null), 3000);
                    return;
                  }
                  setSelectedGiftId(gift.id);
                }}
                className={`relative p-3 rounded-2xl flex flex-col items-center justify-between text-center transition-all border ${
                  isSelected
                    ? 'bg-amber-400/15 border-amber-400 shadow-lg'
                    : 'bg-white/[0.04] border-white/8 hover:bg-white/[0.08]'
                } ${isVipLocked ? 'opacity-50' : ''}`}
              >
                {gift.vipMinLevel && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                    VIP {gift.vipMinLevel}
                  </span>
                )}
                {(gift.videoUrl || gift.imageUrl) && (
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-mono text-rose-300 flex items-center gap-0.5">
                    {getMediaFormatLabel(gift.videoUrl || gift.imageUrl)}
                  </span>
                )}

                {gift.imageUrl || gift.videoUrl ? (
                  <SmartMediaView
                    mode="thumbnail"
                    url={gift.imageUrl || gift.videoUrl}
                    preferVideo={!gift.imageUrl && Boolean(gift.videoUrl)}
                    alt={gift.nameAr}
                    className="w-11 h-11 rounded-xl object-cover my-1"
                    fallback={<div className="text-3xl sm:text-4xl my-1">{gift.icon}</div>}
                  />
                ) : (
                  <div className="text-3xl sm:text-4xl my-1">{gift.icon}</div>
                )}

                <div className="text-xs font-bold text-white truncate w-full mt-1">
                  {gift.nameAr}
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-amber-300 font-bold mt-1">
                  <Coins className="w-3 h-3" />
                  <span>{gift.coinPrice.toLocaleString()}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Recipient & Combo Controls */}
        <div className="p-4 bg-[#090d17] border-t border-white/10 flex flex-col gap-3">
          {vipNotice && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs text-right">
              {vipNotice}
            </div>
          )}

          {/* Target Selector (Occupied Mics Only) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-medium">المستلم:</span>
            {occupiedSeats.length === 0 ? (
              <span className="text-amber-300 font-semibold">
                لا يوجد متحدث على المايك حالياً
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setTargetType('speaker')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    targetType === 'speaker'
                      ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold'
                      : 'bg-white/6 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  المتحدث الحالي
                </button>

                <button
                  onClick={() => setTargetType('all')}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                    targetType === 'all'
                      ? 'bg-rose-500/20 border-rose-400 text-rose-300 font-bold'
                      : 'bg-white/6 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>الكل على المايك ({occupiedSeats.length})</span>
                </button>

                <select
                  value={selectedSeatIndex}
                  onChange={(e) => {
                    setTargetType('seat');
                    setSelectedSeatIndex(Number(e.target.value));
                  }}
                  className="bg-slate-900 border border-white/12 text-white rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-amber-400"
                >
                  {occupiedSeats.map((seat) => (
                    <option key={seat.index} value={seat.index}>
                      مايك {seat.index + 1} ({seat.userName})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Combos Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 font-medium">الكمية (كومبو):</span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {combos.map((c) => (
                <button
                  key={c}
                  onClick={() => setComboCount(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    comboCount === c
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-white/8 text-slate-300 hover:bg-white/14'
                  }`}
                >
                  x{c}
                </button>
              ))}
            </div>
          </div>

          {/* Total & Send Action */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
            <div>
              <div className="text-[11px] text-slate-400">إجمالي التكلفة:</div>
              <div className="flex items-center gap-1.5 text-base sm:text-lg font-mono tabular-nums font-bold text-amber-300">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>{totalCoinsNeeded.toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-normal">عملة</span>
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={!hasEnoughCoins}
              className={`min-h-[44px] flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm shadow-xl transition-all ${
                hasEnoughCoins
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-95'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed'
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
