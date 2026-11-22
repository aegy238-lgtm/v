import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, ShoppingBag, Check, Sparkles, Send, Radio, Video, Play } from 'lucide-react';
import { StoreItem } from '../types';
import { SmartMediaView } from './SmartMediaView';
import { getMediaFormatLabel, resolveEntranceStageMedia } from '../utils/mediaFormats';
import { sound } from '../utils/audio';

interface BackpackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackpackModal: React.FC<BackpackModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    storeItems,
    gifts,
    bagGifts,
    luckyConfig,
    activeRoom,
    rooms,
    activeModal,
    joinRoom,
    consumeBagGift,
    evaluateLuckyGiftWin,
    equipInventoryItem,
    purchaseStoreItem,
    sendRoomMessage,
    triggerFlyingGift,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'lucky_bag' | 'frames' | 'entrances' | 'badges' | 'bubbles' | 'store'
  >(activeModal === 'store' ? 'store' : 'lucky_bag');
  const [storeCategory, setStoreCategory] = useState<'all' | StoreItem['type']>('all');
  const [previewEntrance, setPreviewEntrance] = useState<StoreItem | null>(null);
  const [selectedBagCount, setSelectedBagCount] = useState<number>(1);
  const [bagFeedback, setBagFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(activeModal === 'store' ? 'store' : 'lucky_bag');
    }
  }, [isOpen, activeModal]);

  if (!isOpen) return null;

  const frames = storeItems.filter((i) => i.type === 'frame');
  const equippedFrame = frames.find((f) => f.id === currentUser.activeFrameId);
  const entrances = storeItems.filter((i) => i.type === 'entrance');
  const badges = storeItems.filter((i) => i.type === 'badge');
  const bubbles = storeItems.filter((i) => i.type === 'bubble');

  const ownedBagGiftEntries = Object.entries(bagGifts)
    .filter(([, count]) => count > 0)
    .map(([giftId, count]) => ({
      gift: gifts.find((g) => g.id === giftId),
      count,
    }))
    .filter((entry): entry is { gift: NonNullable<typeof entry.gift>; count: number } =>
      Boolean(entry.gift)
    );

  const occupiedSeats = activeRoom ? activeRoom.seats.filter((s) => Boolean(s.userId)) : [];

  const handleUseBagGiftInRoom = (giftId: string, ownedCount: number) => {
    const giftObj = gifts.find((g) => g.id === giftId);
    if (!giftObj) return;

    if (!activeRoom) {
      const targetRoomId = rooms[0]?.id;
      if (targetRoomId) {
        onClose();
        joinRoom(targetRoomId);
      }
      return;
    }

    if (occupiedSeats.length === 0) {
      setBagFeedback('اصعد على مايك داخل الغرفة أولاً لإرسال هدية الحظ من الحقيبة.');
      setTimeout(() => setBagFeedback(null), 3200);
      return;
    }

    const sendQty = Math.min(ownedCount, selectedBagCount);
    const ok = consumeBagGift(giftId, sendQty);
    if (!ok) return;

    sound.unlockAudio();

    const targetSeat = occupiedSeats[0];
    const targetName = targetSeat.userName || `مايك ${targetSeat.index + 1}`;
    triggerFlyingGift(giftObj, sendQty, targetName);

    if (!giftObj.videoUrl && !giftObj.imageUrl) {
      sound.playGiftHitAudio(giftObj.soundEffect, giftObj.soundUrl);
    }

    const isLucky =
      giftObj.isLucky || giftObj.category === 'lucky' || giftObj.animationType === 'lollipop_matrix';

    if (isLucky) {
      const luckyRes = evaluateLuckyGiftWin(
        giftObj,
        sendQty,
        sendQty,
        giftObj.coinPrice * sendQty,
        activeRoom.title
      );
      if (luckyRes.won) {
        setBagFeedback(
          `🎉 أرسلت ${giftObj.nameAr} ×${sendQty} إلى ${targetSeat.userName || 'المضيف'} وربحت +${luckyRes.winCoins.toLocaleString()} عملة (${luckyRes.multiplier}X)!`
        );
      } else {
        setBagFeedback(`تم إرسال ${giftObj.nameAr} ×${sendQty} من الحقيبة بنجاح.`);
      }
    } else {
      setBagFeedback(`تم إرسال ${giftObj.nameAr} ×${sendQty} من الحقيبة إلى ${targetSeat.userName || 'المضيف'}.`);
    }

    sendRoomMessage(
      `أرسل من الحقيبة ${giftObj.icon} ${giftObj.nameAr} ×${sendQty} إلى ${targetName}`
    );
    setTimeout(() => setBagFeedback(null), 4000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-tajawal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#0e1320] border border-white/12 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-[#090d17] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate">
                الحقيبة الملكية وهدايا الحظ
              </h2>
              <p className="text-xs text-slate-400 truncate">
                إدارة هدايا الحظ في الحقيبة، الإطارات، الدخوليات، والأوسمة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/8 text-slate-300 hover:text-white flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0e18] border-b border-white/8 overflow-x-auto no-scrollbar">
          {[
            { id: 'store', label: `المتجر (${storeItems.length})` },
            { id: 'frames', label: `إطارات الصور (${frames.length})` },
            { id: 'entrances', label: `دخوليات الغرف (${entrances.length})` },
            { id: 'badges', label: `الأوسمة (${badges.length})` },
            ...(bubbles.length > 0 ? [{ id: 'bubbles', label: `الفقاعات (${bubbles.length})` }] : []),
            { id: 'lucky_bag', label: `هدايا الحظ والحقيبة (${ownedBagGiftEntries.reduce((s, e) => s + e.count, 0)})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-white/6 text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {bagFeedback && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs font-bold text-right">
              {bagFeedback}
            </div>
          )}

          {/* Live User Summary Strip */}
          <div className="p-4 rounded-2xl bg-[#141a2b] border border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 text-right w-full sm:w-auto">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <div
                  className={
                    equippedFrame?.previewUrl
                      ? 'w-11 h-11 rounded-full overflow-hidden'
                      : `w-12 h-12 rounded-full overflow-hidden p-0.5 border-2 ${
                          currentUser.activeFrameId === 'frame_gold_wings'
                            ? 'border-amber-400'
                            : currentUser.activeFrameId === 'frame_neon_cyber'
                            ? 'border-cyan-400'
                            : currentUser.activeFrameId === 'frame_ruby_emperor'
                            ? 'border-rose-500'
                            : 'border-white/15'
                        }`
                  }
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                {equippedFrame?.previewUrl && (
                  <img
                    src={equippedFrame.previewUrl}
                    alt={equippedFrame.nameAr}
                    referrerPolicy="no-referrer"
                    className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[72px] h-[72px] object-contain z-20"
                  />
                )}
              </div>

              <div className="min-w-0">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="truncate">{currentUser.displayName}</span>
                  <span className="text-[11px] font-mono text-amber-300">
                    VIP {currentUser.vipLevel}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  نسبة فوز هدايا الحظ الحالية:{' '}
                  <strong className="text-emerald-400 font-mono">{luckyConfig.winRatePercent}%</strong>
                </div>
                {(currentUser.activeFrameId ||
                  currentUser.activeEntranceId ||
                  (currentUser.vipLevel >= 1 && currentUser.activeEntranceId !== '')) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {currentUser.activeFrameId && (
                      <button
                        type="button"
                        onClick={() => {
                          equipInventoryItem('frame', '');
                          setBagFeedback('تمت إزالة الإطار بنجاح — صورتك الآن بدون إطار.');
                          setTimeout(() => setBagFeedback(null), 3200);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[11px] font-bold transition-colors"
                      >
                        إزالة الإطار
                      </button>
                    )}
                    {(currentUser.activeEntranceId ||
                      (currentUser.vipLevel >= 1 && currentUser.activeEntranceId !== '')) && (
                      <button
                        type="button"
                        onClick={() => {
                          equipInventoryItem('entrance', '');
                          setBagFeedback('تمت إزالة الدخولية بنجاح — ستدخل الغرف بدون دخولية.');
                          setTimeout(() => setBagFeedback(null), 3200);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[11px] font-bold transition-colors"
                      >
                        إزالة الدخولية
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 border-white/8 pt-2.5 sm:pt-0">
              <span className="text-xs text-slate-400">رصيد المحفظة:</span>
              <span className="text-sm font-bold font-mono tabular-nums text-amber-300">
                {currentUser.coins.toLocaleString()} عملة
              </span>
            </div>
          </div>

          {/* TAB 0: LUCKY GIFTS & BAG ITEMS */}
          {activeTab === 'lucky_bag' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-300">
                  هدايا الحظ والهدايا المجانية المخزنة في حقيبتك — أرسلها داخل أي غرفة لربح مضاعفات الكوينزات:
                </div>

                {/* Quantity Selector for Bag Send */}
                <div className="flex items-center gap-1.5">
                  {[1, 5, 10, 25].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setSelectedBagCount(qty)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                        selectedBagCount === qty
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white/8 text-slate-300 hover:bg-white/14'
                      }`}
                    >
                      ×{qty}
                    </button>
                  ))}
                </div>
              </div>

              {ownedBagGiftEntries.length === 0 ? (
                <div className="p-10 rounded-3xl bg-white/[0.03] border border-white/8 text-center space-y-3">
                  <div className="text-4xl">🎒</div>
                  <p className="text-xs text-slate-300">
                    لا توجد هدايا في حقيبتك حالياً — يمكنك الحصول عليها من صاروخ الغرفة أو كيس الحظ.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {ownedBagGiftEntries.map(({ gift, count }) => {
                    const isLucky = gift.isLucky || gift.category === 'lucky';
                    return (
                      <div
                        key={gift.id}
                        className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                          isLucky
                            ? 'bg-gradient-to-br from-[#231229] to-[#121626] border-pink-400/35'
                            : 'bg-[#13192a] border-white/8'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {gift.imageUrl ? (
                              <img
                                src={gift.imageUrl}
                                alt={gift.nameAr}
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 rounded-xl object-cover border border-white/15 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-white/8 flex items-center justify-center text-3xl shrink-0">
                                {gift.icon}
                              </div>
                            )}
                            <div className="min-w-0 text-right">
                              <div className="text-sm font-bold text-white truncate">
                                {gift.nameAr}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                {isLucky && (
                                  <span className="text-pink-300 font-semibold flex items-center gap-0.5">
                                    <Sparkles className="w-3 h-3" />
                                    هدية حظ
                                  </span>
                                )}
                                {(gift.videoUrl || gift.imageUrl) && (
                                  <span className="text-rose-300 font-mono flex items-center gap-0.5">
                                    <Video className="w-3 h-3" /> {getMediaFormatLabel(gift.videoUrl || gift.imageUrl)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className="font-mono tabular-nums text-xs font-black text-emerald-400 shrink-0">
                            ×{count}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {gift.descriptionAr}
                        </p>

                        <button
                          type="button"
                          onClick={() => handleUseBagGiftInRoom(gift.id, count)}
                          className="w-full min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          {activeRoom ? (
                            <>
                              <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                              <span>إرسال ×{Math.min(count, selectedBagCount)} في الغرفة</span>
                            </>
                          ) : (
                            <>
                              <Radio className="w-3.5 h-3.5" />
                              <span>دخول الغرفة لاستخدام الهدية</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: FRAMES */}
          {activeTab === 'frames' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {frames.map((frame) => {
                const isEquipped = currentUser.activeFrameId === frame.id;
                return (
                  <div
                    key={frame.id}
                    className={`p-4 rounded-2xl border flex flex-col justify-between text-center transition-all ${
                      isEquipped
                        ? 'bg-amber-500/10 border-amber-400/60'
                        : 'bg-[#13192a] border-white/8'
                    }`}
                  >
                    <div>
                      {frame.previewUrl ? (
                        <div className="relative w-20 h-20 mx-auto my-2 flex items-center justify-center">
                          <img
                            src={currentUser.avatar}
                            alt={frame.nameAr}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <img
                            src={frame.previewUrl}
                            alt={frame.nameAr}
                            referrerPolicy="no-referrer"
                            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[84px] h-[84px] object-contain z-20"
                          />
                        </div>
                      ) : (
                        <div className="text-4xl my-2">{frame.icon}</div>
                      )}
                      <h4 className="font-bold text-sm text-white">{frame.nameAr}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {frame.descriptionAr}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/8">
                      {isEquipped ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="py-1.5 text-xs font-bold text-amber-300 flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            <span>مرتدى حالياً</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              equipInventoryItem('frame', '');
                              setBagFeedback(`تمت إزالة الإطار (${frame.nameAr}) بنجاح!`);
                              setTimeout(() => setBagFeedback(null), 3200);
                            }}
                            className="min-h-[36px] px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold text-xs transition-colors"
                          >
                            إزالة
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            equipInventoryItem('frame', frame.id);
                            setBagFeedback(`تم تفعيل الإطار (${frame.nameAr}) وسيظهر حول صورتك وعلى المايك فوراً!`);
                            setTimeout(() => setBagFeedback(null), 3200);
                          }}
                          className="w-full min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors"
                        >
                          ارتداء هذا الإطار
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: ENTRANCES */}
          {activeTab === 'entrances' && (
            <div className="space-y-4">
              {currentUser.vipLevel >= 1 &&
                currentUser.activeEntranceId !== '' &&
                !entrances.some((e) => e.id === currentUser.activeEntranceId) && (
                  <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-400/35 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-cyan-100 font-semibold">
                      تعمل حالياً دخولية VIP {currentUser.vipLevel} الافتراضية عند دخولك الغرف.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        equipInventoryItem('entrance', '');
                        setBagFeedback('تمت إزالة الدخولية الافتراضية — لن يظهر أي تأثير دخولية.');
                        setTimeout(() => setBagFeedback(null), 3200);
                      }}
                      className="min-h-[34px] px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold transition-colors"
                    >
                      إزالة الدخولية
                    </button>
                  </div>
                )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {entrances.map((ent) => {
                  const isEquipped = currentUser.activeEntranceId === ent.id;
                  return (
                    <div
                      key={ent.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between text-center transition-all ${
                        isEquipped
                          ? 'bg-cyan-500/10 border-cyan-400/60'
                          : 'bg-[#13192a] border-white/8'
                      }`}
                    >
                      <div>
                        <div className="relative h-24 rounded-xl bg-[#0a0e1a] border border-white/8 flex items-center justify-center overflow-hidden mb-3">
                          {ent.videoUrl || ent.previewUrl ? (
                            <SmartMediaView
                              mode="thumbnail"
                              url={ent.videoUrl || ent.previewUrl}
                              preferVideo={Boolean(ent.videoUrl)}
                              alt={ent.nameAr}
                              className="w-full h-full object-contain p-1"
                              fallback={<div className="text-4xl">{ent.icon}</div>}
                            />
                          ) : (
                            <div className="text-4xl">{ent.icon}</div>
                          )}
                          {(ent.videoUrl || ent.previewUrl) && (
                            <button
                              type="button"
                              onClick={() => setPreviewEntrance(ent)}
                              className="absolute bottom-1.5 left-1.5 px-2 py-1 rounded-lg bg-black/75 border border-white/15 text-[10px] font-bold text-amber-300 flex items-center gap-1 hover:bg-black"
                            >
                              <Play className="w-3 h-3" />
                              <span>معاينة</span>
                            </button>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-white">{ent.nameAr}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {ent.descriptionAr}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/8">
                        {isEquipped ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="py-1.5 text-xs font-bold text-cyan-300 flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              <span>الدخولية المعتمدة</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                equipInventoryItem('entrance', '');
                                setBagFeedback(`تمت إزالة الدخولية (${ent.nameAr}) بنجاح!`);
                                setTimeout(() => setBagFeedback(null), 3200);
                              }}
                              className="min-h-[36px] px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold text-xs transition-colors"
                            >
                              إزالة
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              equipInventoryItem('entrance', ent.id);
                              setBagFeedback(`تم تفعيل الدخولية (${ent.nameAr}) وتعمل عند دخولك الغرف الصوتية!`);
                              setTimeout(() => setBagFeedback(null), 3200);
                            }}
                            className="w-full min-h-[40px] rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-colors"
                          >
                            تفعيل هذه الدخولية
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: BADGES */}
          {activeTab === 'badges' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {badges.map((badge) => {
                const isEquipped = currentUser.activeBadgeId === badge.id;
                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-2xl border flex flex-col justify-between text-center transition-all ${
                      isEquipped
                        ? 'bg-amber-500/10 border-amber-400/60'
                        : 'bg-[#13192a] border-white/8'
                    }`}
                  >
                    <div>
                      {badge.previewUrl ? (
                        <img
                          src={badge.previewUrl}
                          alt={badge.nameAr}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 mx-auto my-2 object-contain rounded-xl"
                        />
                      ) : (
                        <div className="text-4xl my-2">{badge.icon}</div>
                      )}
                      <h4 className="font-bold text-sm text-white">{badge.nameAr}</h4>
                      <p className="text-xs text-slate-400 mt-1">{badge.descriptionAr}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/8">
                      {isEquipped ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="py-1.5 text-xs font-bold text-amber-300 flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            <span>شارة مفعلة</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              equipInventoryItem('badge', '');
                              setBagFeedback(`تمت إزالة الشارة (${badge.nameAr}) بنجاح!`);
                              setTimeout(() => setBagFeedback(null), 3200);
                            }}
                            className="min-h-[36px] px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold text-xs transition-colors"
                          >
                            إزالة
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            equipInventoryItem('badge', badge.id);
                            setBagFeedback(`تم ارتداء الشارة (${badge.nameAr}) بنجاح!`);
                            setTimeout(() => setBagFeedback(null), 3200);
                          }}
                          className="w-full min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors"
                        >
                          ارتداء الشارة
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3B: CHAT BUBBLES */}
          {activeTab === 'bubbles' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {bubbles.map((bubble) => {
                const isEquipped = currentUser.activeBubbleId === bubble.id;
                return (
                  <div
                    key={bubble.id}
                    className={`p-4 rounded-2xl border flex flex-col justify-between text-center transition-all ${
                      isEquipped
                        ? 'bg-purple-500/10 border-purple-400/60'
                        : 'bg-[#13192a] border-white/8'
                    }`}
                  >
                    <div>
                      {bubble.previewUrl ? (
                        <img
                          src={bubble.previewUrl}
                          alt={bubble.nameAr}
                          referrerPolicy="no-referrer"
                          className="h-16 mx-auto my-2 object-contain rounded-xl"
                        />
                      ) : (
                        <div className="text-4xl my-2">{bubble.icon}</div>
                      )}
                      <h4 className="font-bold text-sm text-white">{bubble.nameAr}</h4>
                      <p className="text-xs text-slate-400 mt-1">{bubble.descriptionAr}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/8">
                      {isEquipped ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="py-1.5 text-xs font-bold text-purple-300 flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            <span>فقاعة مفعلة</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              equipInventoryItem('bubble', '');
                              setBagFeedback(`تمت إزالة فقاعة الدردشة (${bubble.nameAr})!`);
                              setTimeout(() => setBagFeedback(null), 3200);
                            }}
                            className="min-h-[36px] px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold text-xs transition-colors"
                          >
                            إزالة
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            equipInventoryItem('bubble', bubble.id);
                            setBagFeedback(`تم تفعيل فقاعة الدردشة (${bubble.nameAr})!`);
                            setTimeout(() => setBagFeedback(null), 3200);
                          }}
                          className="w-full min-h-[40px] rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-black text-xs transition-colors"
                        >
                          تفعيل الفقاعة
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: FULL STORE BUY ITEMS (Frames, Entrances, Badges, Bubbles) */}
          {activeTab === 'store' && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                {[
                  { id: 'all', label: `الكل (${storeItems.length})` },
                  { id: 'frame', label: `الإطارات (${frames.length})` },
                  { id: 'entrance', label: `تأثيرات الدخول (${entrances.length})` },
                  { id: 'badge', label: `الأوسمة (${badges.length})` },
                  { id: 'bubble', label: `الفقاعات (${bubbles.length})` },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setStoreCategory(cat.id as typeof storeCategory)}
                    className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      storeCategory === cat.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-white/6 text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {storeItems
                  .filter((item) => storeCategory === 'all' || item.type === storeCategory)
                  .map((item) => {
                    const isEquipped =
                      (item.type === 'frame' && currentUser.activeFrameId === item.id) ||
                      (item.type === 'entrance' && currentUser.activeEntranceId === item.id) ||
                      (item.type === 'badge' && currentUser.activeBadgeId === item.id) ||
                      (item.type === 'bubble' && currentUser.activeBubbleId === item.id);
                    const typeLabels: Record<StoreItem['type'], string> = {
                      frame: 'إطار',
                      entrance: 'دخولية',
                      badge: 'وسام',
                      bubble: 'فقاعة',
                    };

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                          isEquipped
                            ? 'bg-amber-500/10 border-amber-400/50'
                            : 'bg-[#13192a] border-white/8'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="px-2 py-0.5 rounded-lg bg-white/8 text-[10px] font-bold text-amber-300">
                              {typeLabels[item.type]}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {item.durationDays} يوم
                            </span>
                          </div>

                          {/* Visual Store Preview Box */}
                          <div className="relative h-24 rounded-xl bg-[#0a0e1a] border border-white/8 flex items-center justify-center overflow-hidden mb-3">
                            {item.type === 'frame' && item.previewUrl ? (
                              <div className="relative w-20 h-20 flex items-center justify-center">
                                <img
                                  src={currentUser.avatar}
                                  alt={item.nameAr}
                                  referrerPolicy="no-referrer"
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                                <img
                                  src={item.previewUrl}
                                  alt={item.nameAr}
                                  referrerPolicy="no-referrer"
                                  className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[84px] h-[84px] object-contain z-20"
                                />
                              </div>
                            ) : item.type === 'entrance' && (item.videoUrl || item.previewUrl) ? (
                              <SmartMediaView
                                mode="thumbnail"
                                url={item.videoUrl || item.previewUrl}
                                preferVideo={Boolean(item.videoUrl)}
                                alt={item.nameAr}
                                className="w-full h-full object-contain p-1"
                                fallback={<span className="text-4xl">{item.icon}</span>}
                              />
                            ) : item.previewUrl ? (
                              <SmartMediaView
                                mode="thumbnail"
                                url={item.previewUrl}
                                alt={item.nameAr}
                                className="w-full h-full object-contain p-1.5"
                                fallback={<span className="text-4xl">{item.icon}</span>}
                              />
                            ) : (
                              <span className="text-4xl">{item.icon}</span>
                            )}

                            {item.type === 'entrance' && (item.videoUrl || item.previewUrl) && (
                              <button
                                type="button"
                                onClick={() => setPreviewEntrance(item)}
                                className="absolute bottom-1.5 left-1.5 px-2 py-1 rounded-lg bg-black/75 border border-white/15 text-[10px] font-bold text-amber-300 flex items-center gap-1 hover:bg-black"
                              >
                                <Play className="w-3 h-3" />
                                <span>معاينة</span>
                              </button>
                            )}
                          </div>

                          <h4 className="font-bold text-sm text-white">{item.nameAr}</h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.descriptionAr}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/8 flex items-center justify-between gap-2">
                          <div className="font-mono tabular-nums font-bold text-xs text-amber-300">
                            {item.priceCoins.toLocaleString()} عملة
                          </div>
                          {isEquipped ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>مفعل</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  equipInventoryItem(item.type, '');
                                  setBagFeedback(`تمت إزالة (${item.nameAr}) بنجاح!`);
                                  setTimeout(() => setBagFeedback(null), 3200);
                                }}
                                className="min-h-[34px] px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold text-xs transition-colors"
                              >
                                إزالة
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                const ok = purchaseStoreItem(item.id);
                                if (ok) {
                                  setBagFeedback(`تم شراء وتفعيل (${item.nameAr}) بنجاح!`);
                                  setTimeout(() => setBagFeedback(null), 3500);
                                }
                              }}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors"
                            >
                              شراء وتفعيل
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Store Entrance Effect Preview Overlay */}
      {previewEntrance && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewEntrance(null);
          }}
        >
          <div
            className="relative w-full max-w-sm aspect-[9/16] max-h-[82dvh] rounded-3xl overflow-hidden bg-[#0a0e1a] border border-amber-400/50 shadow-2xl flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewEntrance(null)}
              className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            {(() => {
              const resolved = resolveEntranceStageMedia(previewEntrance);
              if (resolved.primaryUrl) {
                return (
                  <SmartMediaView
                    mode="stage"
                    url={resolved.primaryUrl}
                    fallbackUrl={previewEntrance.previewUrl}
                    preferVideo={resolved.preferVideo}
                    alt={previewEntrance.nameAr}
                    loop
                  />
                );
              }
              return <span className="text-7xl animate-bounce">{previewEntrance.icon}</span>;
            })()}
            <div className="relative z-20 mt-auto mb-8 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#1d1408]/95 via-[#31210d]/95 to-[#1d1408]/95 border border-amber-400/60 flex items-center gap-3 shadow-2xl">
              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-amber-400"
              />
              <div className="text-right text-xs">
                <div className="font-black text-amber-300">{currentUser.displayName}</div>
                <div className="text-slate-200">{previewEntrance.nameAr}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
