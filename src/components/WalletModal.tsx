import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Coins,
  Gem,
  ArrowRightLeft,
  CreditCard,
  CheckCircle2,
  Sparkles,
  Shield,
  Copy,
  Check,
  Gift,
  Wallet,
  Crown,
} from 'lucide-react';
import { RECHARGE_PACKAGES } from '../data/mockData';
import confetti from 'canvas-confetti';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    transactions,
    rechargeCoins,
    convertDiamondsToCoins,
    requestWithdrawal,
    setCurrentView,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'recharge' | 'exchange' | 'withdraw' | 'history'>('recharge');
  const [selectedPackage, setSelectedPackage] = useState(RECHARGE_PACKAGES[2]);
  const [customCoinsAmount, setCustomCoinsAmount] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Apple Pay / Mada');
  const [promoCode, setPromoCode] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Exchange state
  const [exchangeAmount, setExchangeAmount] = useState<number>(1000);

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState<number>(50000);
  const [bankInfo, setBankInfo] = useState('');

  if (!isOpen) return null;

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner(null);
    }, 4500);
  };

  const handleCopyUserCode = () => {
    navigator.clipboard?.writeText(currentUser.userCode);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleRecharge = () => {
    const customNum = Number(customCoinsAmount);
    const baseCoins = customNum > 0 ? customNum : selectedPackage.coins;
    const bonusCoins = customNum > 0 ? Math.round(customNum * 0.15) : selectedPackage.bonus;
    const totalToCredit = baseCoins + bonusCoins;

    rechargeCoins(totalToCredit, selectedPaymentMethod);
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    showToast(
      'success',
      `✅ تم شحن ${totalToCredit.toLocaleString()} كوينز بنجاح عبر ${selectedPaymentMethod}!`
    );
    setCustomCoinsAmount('');
  };

  const handleRedeemCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    const reward = 25000;
    rechargeCoins(reward, `كود شحن (${promoCode.trim().toUpperCase()})`);
    confetti({ particleCount: 55, spread: 70, origin: { y: 0.6 } });
    showToast('success', `🎁 تم تفعيل الكود بنجاح وإضافة ${reward.toLocaleString()} كوينز إلى محفظتك!`);
    setPromoCode('');
  };

  const handleExchange = (e: React.FormEvent) => {
    e.preventDefault();
    if (exchangeAmount <= 0 || currentUser.diamonds < exchangeAmount) {
      showToast('error', 'رصيد الألماس غير كافٍ لإتمام التحويل');
      return;
    }
    const ok = convertDiamondsToCoins(exchangeAmount);
    if (ok) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      showToast(
        'success',
        `✅ تم تحويل ${exchangeAmount.toLocaleString()} ألماسة إلى ${Math.round(exchangeAmount * 2.1).toLocaleString()} كوينز فوراً!`
      );
    }
  };

  const handleWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmount <= 0 || !bankInfo.trim()) {
      showToast('error', 'يرجى إدخال بيانات الحساب البنكي أو رقم المحفظة الإلكترونية');
      return;
    }
    if (currentUser.diamonds < withdrawAmount) {
      showToast('error', 'رصيد الألماس أقل من المبلغ المطلوب سحبه');
      return;
    }
    const ok = requestWithdrawal(withdrawAmount, bankInfo);
    if (ok) {
      showToast(
        'success',
        `💵 تم إرسال طلب سحب $${Math.round(withdrawAmount / 200).toLocaleString()} USD بنجاح!`
      );
      setBankInfo('');
    }
  };

  const customNumVal = Number(customCoinsAmount);
  const effectiveCoins =
    customNumVal > 0 ? customNumVal + Math.round(customNumVal * 0.15) : selectedPackage.coins + selectedPackage.bonus;
  const effectivePriceUSD =
    customNumVal > 0 ? (customNumVal / 750).toFixed(2) : selectedPackage.priceUSD;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-tajawal">
      <div className="w-full max-w-md sm:max-w-2xl bg-[#110d1b] border-t-2 sm:border-2 border-amber-400/50 rounded-t-[32px] sm:rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.25)] overflow-hidden flex flex-col max-h-[94vh] text-white">
        
        {/* Top Luxury Header */}
        <div className="p-4 bg-gradient-to-r from-[#1f1535] via-[#2a1b4e] to-[#1f1535] border-b border-white/10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 text-stone-300 hover:text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <h2 className="text-base font-black text-amber-300 flex items-center justify-end gap-1.5">
                <span>المحفظة الملكية والشحن الفوري</span>
                <Wallet className="w-4 h-4 text-amber-400" />
              </h2>
              <div className="flex items-center justify-end gap-1.5 text-[11px] text-stone-300">
                <button
                  onClick={handleCopyUserCode}
                  className="flex items-center gap-1 px-2 py-0.2 rounded-full bg-black/40 border border-white/10 text-amber-200 font-mono"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>ID:{currentUser.userCode}</span>
                </button>
                <span>{currentUser.displayName}</span>
              </div>
            </div>
            <img
              src={currentUser.avatar}
              alt={currentUser.displayName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-400"
            />
          </div>
        </div>

        {/* Toast Notification Banner */}
        {statusBanner && (
          <div
            className={`mx-4 mt-3 px-4 py-2.5 rounded-2xl text-xs font-black text-right flex items-center justify-between border animate-in zoom-in-95 ${
              statusBanner.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-rose-500/20 border-rose-400 text-rose-200'
            }`}
          >
            <button onClick={() => setStatusBanner(null)} className="text-white/60 hover:text-white">
              ✕
            </button>
            <span>{statusBanner.text}</span>
          </div>
        )}

        {/* Dual 3D Balance Cards (Matching Screenshot Style: Gold Coins + Purple Diamonds) */}
        <div className="p-3.5 grid grid-cols-2 gap-3 bg-[#161024] border-b border-white/10">
          {/* Gold Coins Card */}
          <div
            onClick={() => setActiveTab('recharge')}
            className={`relative overflow-hidden rounded-2xl p-3 bg-gradient-to-br from-amber-500/30 via-yellow-600/20 to-amber-950/60 border-2 cursor-pointer transition-all ${
              activeTab === 'recharge' ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'border-amber-400/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">🪙</span>
              <span className="text-xs font-black text-amber-200">الكونزة (الكوينز)</span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-white text-right mt-1">
              {currentUser.coins.toLocaleString()}
            </div>
            <div className="mt-1.5 flex items-center justify-end">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                شحن فوري +
              </span>
            </div>
          </div>

          {/* Purple Diamonds Card */}
          <div
            onClick={() => setActiveTab('exchange')}
            className={`relative overflow-hidden rounded-2xl p-3 bg-gradient-to-br from-fuchsia-500/30 via-purple-600/20 to-indigo-950/60 border-2 cursor-pointer transition-all ${
              activeTab === 'exchange' || activeTab === 'withdraw'
                ? 'border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.3)]'
                : 'border-fuchsia-400/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">💎</span>
              <span className="text-xs font-black text-fuchsia-200">الماس (الأرباح)</span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-white text-right mt-1">
              {currentUser.diamonds.toLocaleString()}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px]">
              <span className="text-fuchsia-300 font-mono font-bold">
                ≈ ${(currentUser.diamonds / 200).toFixed(1)}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-fuchsia-400 text-slate-950 font-black">
                تحويل / سحب
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-1.5 px-3 py-2 bg-[#0d0914] border-b border-white/10 overflow-x-auto no-scrollbar">
          {[
            { id: 'history', label: 'السجل 📋' },
            { id: 'withdraw', label: 'سحب نقدي 💵' },
            { id: 'exchange', label: 'استبدال الماس 🔄' },
            { id: 'recharge', label: 'شراء كوينزات 🪙' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md'
                  : 'bg-white/5 text-stone-300 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          
          {/* =============================================================== */}
          {/* TAB 1: RECHARGE COINS                                           */}
          {/* =============================================================== */}
          {activeTab === 'recharge' && (
            <div className="space-y-4">
              
              {/* Payment Methods Grid */}
              <div>
                <div className="text-xs font-black text-amber-200 text-right mb-2">
                  1. اختر وسيلة الدفع المفضلة:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Apple Pay / Mada', label: 'Apple Pay / مدى', icon: '' },
                    { id: 'Visa / MasterCard', label: 'بطاقة بنكية Visa', icon: '💳' },
                    { id: 'Vodafone / STC Pay', label: 'فودافون / STC Pay', icon: '📱' },
                    { id: 'USDT / Binance', label: 'عملات رقمية USDT', icon: '🪙' },
                    { id: 'Google Play', label: 'رصيد Google Play', icon: '▶️' },
                    { id: 'Official Agent', label: 'وكيل شحن معتمد', icon: '⭐' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => {
                        setSelectedPaymentMethod(method.id);
                        if (method.id === 'Official Agent') {
                          onClose();
                          setCurrentView('agent_portal');
                        }
                      }}
                      className={`p-2 rounded-2xl border text-center flex flex-col items-center justify-center gap-0.5 transition-all ${
                        selectedPaymentMethod === method.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 scale-[1.02] shadow-md'
                          : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-lg">{method.icon}</span>
                      <span className="text-[10px] font-black leading-tight">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recharge Packages Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-emerald-400 font-black">
                    ⚡ تسليم فوري + نقاط VIP مجانية
                  </span>
                  <span className="text-xs font-black text-amber-200">
                    2. اختر باقة شحن الكوينزات:
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {RECHARGE_PACKAGES.map((pkg, idx) => {
                    const isSelected = customNumVal === 0 && selectedPackage.coins === pkg.coins;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setCustomCoinsAmount('');
                        }}
                        className={`relative p-3 rounded-2xl border text-center flex flex-col items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-gradient-to-b from-amber-500/25 to-amber-900/30 border-2 border-amber-400 scale-[1.02] shadow-lg'
                            : 'bg-white/5 border-white/10 hover:border-amber-400/40'
                        }`}
                      >
                        {pkg.popular && (
                          <span className="absolute -top-2 inset-x-0 mx-auto w-fit px-2 py-0.2 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black text-[9px] shadow">
                            الأكثر مبيعاً 🔥
                          </span>
                        )}

                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-lg">🪙</span>
                          <span className="text-base font-mono font-black text-amber-300">
                            {pkg.coins.toLocaleString()}
                          </span>
                        </div>

                        {pkg.bonus > 0 ? (
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded-full mt-1">
                            +{pkg.bonus.toLocaleString()} مجاناً
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-400 mt-1">باقة أساسية</span>
                        )}

                        <div className="w-full mt-2 pt-1.5 border-t border-white/10 font-mono font-black text-xs text-white">
                          ${pkg.priceUSD} USD
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Coin Amount Input + Promo Code Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Custom Coins Input */}
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-right">
                  <label className="block text-[10px] font-bold text-amber-200 mb-1">
                    أو أدخل كمية كوينز مخصصة (+15% بونص إضافي):
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="500"
                    value={customCoinsAmount}
                    onChange={(e) => setCustomCoinsAmount(e.target.value)}
                    placeholder="مثال: 50000 كوينز..."
                    className="w-full bg-black/50 border border-amber-400/40 rounded-xl px-3 py-1.5 text-xs font-mono text-white text-right focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Instant Promo / Gift Code */}
                <form
                  onSubmit={handleRedeemCode}
                  className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-right"
                >
                  <label className="block text-[10px] font-bold text-teal-300 mb-1">
                    لديك كود هدية أو قسيمة شحن؟ (جرب VIP2026):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-teal-500 text-slate-950 font-black text-xs shrink-0"
                    >
                      تفعيل
                    </button>
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="أدخل الكود هنا..."
                      className="w-full bg-black/50 border border-teal-400/40 rounded-xl px-3 py-1.5 text-xs text-white text-right focus:outline-none"
                    />
                  </div>
                </form>
              </div>

              {/* Sticky Checkout Confirmation Bar */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/90 via-stone-900 to-amber-950/90 border-2 border-amber-400/80 flex items-center justify-between gap-3 shadow-xl">
                <button
                  onClick={handleRecharge}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(251,191,36,0.5)] active:scale-95 transition-transform shrink-0"
                >
                  شراء وتأكيد الشحن (${effectivePriceUSD})
                </button>

                <div className="text-right">
                  <div className="text-[10px] text-stone-300">إجمالي ما ستحصل عليه فوراً:</div>
                  <div className="text-base sm:text-lg font-mono font-black text-amber-300">
                    {effectiveCoins.toLocaleString()} 🪙
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: EXCHANGE DIAMONDS TO COINS                               */}
          {/* =============================================================== */}
          {activeTab === 'exchange' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-400/40 text-xs text-fuchsia-200 flex items-center justify-end gap-2 text-right">
                <span>
                  استبدل الألماس المكتسب من الهدايا بكوينزات ذهبية فوراً مع مكافأة إضافية +10% مجاناً!
                </span>
                <Sparkles className="w-5 h-5 text-fuchsia-400 shrink-0" />
              </div>

              {/* Quick Exchange Presets */}
              <div className="grid grid-cols-4 gap-2">
                {[500, 1000, 5000, 25000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExchangeAmount(preset)}
                    className={`py-2 rounded-xl font-mono font-black text-xs border transition-all ${
                      exchangeAmount === preset
                        ? 'bg-fuchsia-500 text-white border-white shadow'
                        : 'bg-white/5 text-fuchsia-200 border-white/10'
                    }`}
                  >
                    💎 {preset.toLocaleString()}
                  </button>
                ))}
              </div>

              <form onSubmit={handleExchange} className="space-y-3 text-right">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    كمية الألماس المراد تحويلها (المتاح: {currentUser.diamonds.toLocaleString()} 💎):
                  </label>
                  <input
                    type="number"
                    min="100"
                    value={exchangeAmount}
                    onChange={(e) => setExchangeAmount(Number(e.target.value))}
                    className="w-full bg-black/50 border border-fuchsia-400/50 rounded-2xl px-4 py-2.5 text-white font-mono text-base text-right focus:outline-none"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-stone-300">
                    <span className="font-mono">{(exchangeAmount * 2).toLocaleString()} 🪙</span>
                    <span>القيمة الأساسية (1 ألماس = 2 كوينز):</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span className="font-mono">+{Math.round(exchangeAmount * 0.1).toLocaleString()} 🪙</span>
                    <span>بونص المحفظة الملكية (+10%):</span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-sm font-black text-amber-300">
                    <span className="font-mono text-base">
                      {Math.round(exchangeAmount * 2.1).toLocaleString()} 🪙
                    </span>
                    <span>الإجمالي المضاف لرصيد الكوينز:</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 text-white font-black text-sm shadow-lg active:scale-95 transition-transform"
                >
                  تحويل الألماس إلى كوينزات فوراً 🔄
                </button>
              </form>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: WITHDRAW PROFITS                                         */}
          {/* =============================================================== */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4 text-right">
              <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200 flex items-center justify-end gap-2">
                <span>
                  سحب أرباح المضيفين والوكالات نقداً بالدولار عبر التحويل البنكي أو USDT أو المحافظ الإلكترونية.
                </span>
                <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
              </div>

              <form onSubmit={handleWithdrawal} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    كمية الألماس المراد سحبها نقداً:
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                    className="w-full bg-black/50 border border-emerald-400/50 rounded-2xl px-4 py-2.5 text-white font-mono text-base text-right focus:outline-none"
                  />
                  <div className="text-xs font-mono font-black text-emerald-400 mt-1">
                    المبلغ المستحق بالدولار: ${(withdrawAmount / 200).toFixed(2)} USD
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1">
                    بيانات الاستلام (رقم IBAN البنكي / رقم فودافون كاش / عنوان محفظة USDT TRC20):
                  </label>
                  <textarea
                    rows={2}
                    value={bankInfo}
                    onChange={(e) => setBankInfo(e.target.value)}
                    placeholder="اكتب تفاصيل حسابك البنكي أو رقم المحفظة والاسم بالكامل..."
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3 text-xs text-white text-right focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-sm shadow-lg active:scale-95 transition-transform"
                >
                  تأكيد وإرسال طلب السحب النقدي 💵
                </button>
              </form>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: TRANSACTIONS HISTORY                                     */}
          {/* =============================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  لا توجد عمليات مسجلة بعد
                </div>
              ) : (
                transactions.slice(0, 25).map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="text-left shrink-0">
                      {tx.coinsDelta !== 0 && (
                        <div
                          className={`font-mono font-black ${
                            tx.coinsDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {tx.coinsDelta > 0 ? `+${tx.coinsDelta.toLocaleString()}` : tx.coinsDelta.toLocaleString()} 🪙
                        </div>
                      )}
                      {tx.diamondsDelta !== 0 && (
                        <div
                          className={`font-mono font-black ${
                            tx.diamondsDelta > 0 ? 'text-fuchsia-400' : 'text-purple-400'
                          }`}
                        >
                          {tx.diamondsDelta > 0 ? `+${tx.diamondsDelta.toLocaleString()}` : tx.diamondsDelta.toLocaleString()} 💎
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-white">{tx.details}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{tx.timestamp}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
