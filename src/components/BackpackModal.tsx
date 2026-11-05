import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, ShoppingBag, Check, Sparkles, Crown, Zap, Shield, Eye } from 'lucide-react';
import { StoreItem } from '../types';

interface BackpackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackpackModal: React.FC<BackpackModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    storeItems,
    equipInventoryItem,
    purchaseStoreItem,
    setActiveModal,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'frames' | 'entrances' | 'badges' | 'store'>('frames');
  const [previewItem, setPreviewItem] = useState<StoreItem>(storeItems[0]);

  if (!isOpen) return null;

  const frames = storeItems.filter((i) => i.type === 'frame');
  const entrances = storeItems.filter((i) => i.type === 'entrance');
  const badges = storeItems.filter((i) => i.type === 'badge');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100">
                الحقيبة والمتجر الحصري
              </h2>
              <p className="text-xs text-slate-400">
                إدارة الإطارات والدخوليات والشارات الخاصة بك
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 overflow-x-auto no-scrollbar">
          {[
            { id: 'frames', label: 'إطارات الصور 🪽' },
            { id: 'entrances', label: 'دخوليات الغرف 🚘' },
            { id: 'badges', label: 'الشارات والأوسمة 🎖️' },
            { id: 'store', label: 'متجر شراء العناصر 🛒' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Live Preview Bar */}
          <div className="p-4 rounded-3xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center sm:text-right">
              {/* Avatar Preview */}
              <div className="relative">
                <div className={`w-16 h-16 rounded-full p-1 border-4 ${
                  currentUser.activeFrameId === 'frame_gold_wings'
                    ? 'border-amber-400 ring-2 ring-yellow-300'
                    : currentUser.activeFrameId === 'frame_neon_cyber'
                    ? 'border-cyan-400 ring-2 ring-blue-500'
                    : currentUser.activeFrameId === 'frame_ruby_emperor'
                    ? 'border-rose-500 ring-2 ring-red-400'
                    : 'border-slate-600'
                } shadow-xl`}>
                  <img
                    src={currentUser.avatar}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <div className="absolute -top-2 inset-x-0 flex justify-center">
                  <span className="text-base">👑</span>
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-slate-100 flex items-center justify-center sm:justify-start gap-2">
                  <span>{currentUser.displayName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    VIP {currentUser.vipLevel}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-2">
                  <span>الإطار: <strong className="text-amber-400">{currentUser.activeFrameId ? 'مفعّل' : 'افتراضي'}</strong></span>
                  <span>·</span>
                  <span>الدخولية: <strong className="text-cyan-400">{currentUser.activeEntranceId ? 'رولز رويس' : 'افتراضية'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">رصيدك:</span>
              <span className="text-sm font-bold font-mono text-amber-300">{currentUser.coins.toLocaleString()} عملة</span>
            </div>
          </div>

          {/* TAB 1: FRAMES */}
          {activeTab === 'frames' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {frames.map((frame) => {
                const isEquipped = currentUser.activeFrameId === frame.id;
                return (
                  <div
                    key={frame.id}
                    className={`p-4 rounded-3xl border flex flex-col justify-between text-center transition-all ${
                      isEquipped
                        ? 'bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-4xl my-2">{frame.icon}</div>
                      <h4 className="font-bold text-sm text-slate-100">{frame.nameAr}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{frame.descriptionAr}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      {isEquipped ? (
                        <div className="py-2 text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4" />
                          <span>مرتدى حالياً</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => equipInventoryItem('frame', frame.id)}
                          className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {entrances.map((ent) => {
                const isEquipped = currentUser.activeEntranceId === ent.id;
                return (
                  <div
                    key={ent.id}
                    className={`p-4 rounded-3xl border flex flex-col justify-between text-center transition-all ${
                      isEquipped
                        ? 'bg-cyan-500/10 border-cyan-400 shadow-lg shadow-cyan-500/10'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-4xl my-2">{ent.icon}</div>
                      <h4 className="font-bold text-sm text-slate-100">{ent.nameAr}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ent.descriptionAr}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      {isEquipped ? (
                        <div className="py-2 text-xs font-bold text-cyan-400 flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4" />
                          <span>الدخولية المعتمدة</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => equipInventoryItem('entrance', ent.id)}
                          className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors"
                        >
                          تفعيل هذه الدخولية
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
                    className={`p-4 rounded-3xl border flex flex-col justify-between text-center transition-all ${
                      isEquipped
                        ? 'bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-4xl my-2">{badge.icon}</div>
                      <h4 className="font-bold text-sm text-slate-100">{badge.nameAr}</h4>
                      <p className="text-xs text-slate-400 mt-1">{badge.descriptionAr}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      {isEquipped ? (
                        <div className="py-2 text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4" />
                          <span>شارة مفعلة</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => equipInventoryItem('badge', badge.id)}
                          className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
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

          {/* TAB 4: STORE BUY ITEMS */}
          {activeTab === 'store' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {storeItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-3xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl">{item.icon}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {item.durationDays} يوم
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 mt-2">{item.nameAr}</h4>
                      <p className="text-xs text-slate-400 mt-1">{item.descriptionAr}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div className="font-mono font-bold text-xs text-amber-300">
                        {item.priceCoins.toLocaleString()} عملة
                      </div>
                      <button
                        onClick={() => purchaseStoreItem(item.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold text-xs hover:opacity-95 shadow-md"
                      >
                        شراء وتفعيل
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
