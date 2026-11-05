import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CreditCard,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Coins,
  History,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { sound } from '../utils/audio';

export const RechargeAgentPortal: React.FC = () => {
  const {
    agents,
    users,
    agentRechargeUser,
    setCurrentView,
    transactions,
  } = useApp();

  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || 'agent_1');
  const [targetUserCode, setTargetUserCode] = useState('');
  const [coinAmount, setCoinAmount] = useState<number>(100000);
  const [pinCode, setPinCode] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const currentAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  // Auto lookup target user
  const foundUser = users.find((u) => u.userCode.trim() === targetUserCode.trim());

  // Commission calculation
  const estimatedCommission = Math.round(coinAmount * (currentAgent.commissionRate / 100));

  const handleStartRecharge = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusFeedback(null);

    if (!foundUser) {
      setStatusFeedback({ type: 'error', message: 'يرجى إدخال رقم ID مستخدم صالح أولاً' });
      return;
    }
    if (coinAmount <= 0) {
      setStatusFeedback({ type: 'error', message: 'يرجى تحديد كمية عملات صالحة' });
      return;
    }
    if (currentAgent.balanceCoins < coinAmount) {
      setStatusFeedback({ type: 'error', message: 'رصيد الوكيل غير كافٍ لتنفيذ هذه العملية' });
      return;
    }

    setShowConfirmModal(true);
  };

  const handleExecuteRecharge = () => {
    if (pinCode !== '1234' && pinCode !== '') {
      // Allow demo PIN
    }

    const res = agentRechargeUser(currentAgent.id, targetUserCode, coinAmount);
    setShowConfirmModal(false);
    setPinCode('');

    if (res.success) {
      setStatusFeedback({ type: 'success', message: res.message });
      setTargetUserCode('');
    } else {
      setStatusFeedback({ type: 'error', message: res.message });
    }
  };

  // Agent's transactions
  const agentTransactions = transactions.filter(
    (t) => t.type === 'agent_recharge_payout' || t.referenceId === currentAgent.agentCode
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Top Banner & Switch Agent */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-teal-900 via-slate-900 to-slate-950 border border-teal-500/30 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg">
            ⭐
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-100">{currentAgent.name}</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
                {currentAgent.agentCode}
              </span>
            </div>
            <p className="text-xs text-slate-400">بوابة وكلاء الشحن المعتمدين الرسمية (Fintech Terminal)</p>
          </div>
        </div>

        {/* Switch Agent Account (for testing/demo) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">تبديل حساب الوكيل:</span>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-500"
          >
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.name} ({ag.agentCode})
              </option>
            ))}
          </select>

          <button
            onClick={() => setCurrentView('user_app')}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            العودة للتطبيق
          </button>
        </div>
      </div>

      {/* Agent KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Available Balance */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-teal-500/30 shadow-lg">
          <span className="text-xs text-teal-400 font-medium flex items-center gap-1.5">
            <Coins className="w-4 h-4" />
            <span>رصيد الوكيل المتاح للشحن</span>
          </span>
          <div className="text-2xl font-black font-mono text-slate-100 mt-1">
            {currentAgent.balanceCoins.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">عملة ذهبية قابلة للتوزيع</span>
        </div>

        {/* Total Recharged */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-xs text-slate-400 font-medium">إجمالي الشحنات المنفذة</span>
          <div className="text-2xl font-black font-mono text-amber-300 mt-1">
            {currentAgent.totalRechargedCoins.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">عملة للمستخدمين</span>
        </div>

        {/* Commission Earned */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>أرباح العمولات المكتسبة</span>
          </span>
          <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
            +{currentAgent.commissionEarnedCoins.toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-500 font-bold">نسبة العمولة: {currentAgent.commissionRate}%</span>
        </div>

        {/* Total Operations Count */}
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-xs text-slate-400 font-medium">عدد العمليات الناجحة</span>
          <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
            {currentAgent.totalOperations.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">عملية شحن معتمدة</span>
        </div>

      </div>

      {/* Main Recharge Form & Verification Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Form (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-teal-400" />
              <span>إرسال شحنة رصيد إلى مستخدم</span>
            </h3>
            <span className="text-xs text-slate-400">تحقق فوري من بيانات المستلم</span>
          </div>

          {statusFeedback && (
            <div
              className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs font-bold ${
                statusFeedback.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500 text-rose-300'
              }`}
            >
              {statusFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusFeedback.message}</span>
            </div>
          )}

          <form onSubmit={handleStartRecharge} className="space-y-4">
            
            {/* Step 1: User ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رقم ID المستخدم (اكتب رقم المعرّف للتحقق التلقائي):
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={targetUserCode}
                  onChange={(e) => setTargetUserCode(e.target.value)}
                  placeholder="مثال: 883921 أو 742110 أو 551982"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                />
                <div className="absolute top-1/2 -translate-y-1/2 ltr:right-3 rtl:left-3 flex items-center gap-2">
                  {foundUser ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تم التحقق</span>
                    </span>
                  ) : targetUserCode.trim().length > 0 ? (
                    <span className="text-[11px] text-rose-400">غير موجود</span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Quick Coin Package Buttons */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                تحديد كمية العملات:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {[50000, 100000, 250000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCoinAmount(amt)}
                    className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                      coinAmount === amt
                        ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="1000"
                step="1000"
                max={currentAgent.balanceCoins}
                value={coinAmount}
                onChange={(e) => setCoinAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Commission Preview Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>المبلغ المخصوم من رصيد الوكيل:</span>
                <span className="font-mono text-rose-400 font-bold">
                  -{coinAmount.toLocaleString()} عملة
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>نسبة عمولة الوكيل المعتمدة ({currentAgent.commissionRate}%):</span>
                <span className="font-mono text-emerald-400 font-bold">
                  +{estimatedCommission.toLocaleString()} عملة
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold text-slate-100">
                <span>الرصيد المتبقي للوكيل بعد التنفيذ:</span>
                <span className="font-mono text-teal-300">
                  {(currentAgent.balanceCoins - coinAmount).toLocaleString()} عملة
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!foundUser || coinAmount <= 0}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 text-slate-950 font-black text-sm shadow-xl shadow-teal-500/20 hover:opacity-95 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              <span>مراجعة بيانات الشحن قبل التأكيد</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>

          </form>
        </div>

        {/* Right Preview Card (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-300 mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-teal-400" />
              <span>بطاقة التحقق من هوية المستلم</span>
            </h3>

            {foundUser ? (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center space-y-3">
                <div className="relative">
                  <img
                    src={foundUser.avatar}
                    alt={foundUser.displayName}
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-amber-400"
                  />
                  <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                    VIP {foundUser.vipLevel}
                  </span>
                </div>

                <div>
                  <h4 className="font-black text-base text-slate-100">{foundUser.displayName}</h4>
                  <div className="text-xs text-amber-400 font-mono mt-0.5">ID: {foundUser.userCode}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{foundUser.country} {foundUser.countryFlag}</div>
                </div>

                <div className="w-full pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-900">
                    <span className="text-[10px] text-slate-400">الرصيد الحالي</span>
                    <div className="font-mono font-bold text-amber-300 mt-0.5">
                      {foundUser.coins.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900">
                    <span className="text-[10px] text-slate-400">المستوى الحالي</span>
                    <div className="font-mono font-bold text-slate-200 mt-0.5">
                      Lv.{foundUser.level}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-10 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500 space-y-2">
                <Search className="w-8 h-8 text-slate-700 mx-auto" />
                <p>اكتب رقم ID المستخدم في الخانة المقابلة لمطابقة صورته واسمه ومنع الأخطاء.</p>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>جميع عمليات الشحن مشفرة ومسجلة في السجل المالي غير القابل للتعديل.</span>
          </div>
        </div>

      </div>

      {/* CONFIRMATION POPUP MODAL */}
      {showConfirmModal && foundUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-teal-500/50 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500 text-teal-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                ⚡
              </div>
              <h3 className="font-black text-lg text-slate-100">تأكيد تنفيذ عملية الشحن</h3>
              <p className="text-xs text-slate-400 mt-1">
                تأكد من مطابقة بيانات الحساب قبل خصم الرصيد النهائي
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">اسم المستلم:</span>
                <span className="font-bold text-slate-200">{foundUser.displayName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">معرف ID:</span>
                <span className="font-mono font-bold text-amber-400">{foundUser.userCode}</span>
              </div>
              <div className="flex items-center justify-between text-base font-bold text-teal-300 pt-2 border-t border-slate-800">
                <span>كمية العملات:</span>
                <span className="font-mono font-black">{coinAmount.toLocaleString()} عملة</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleExecuteRecharge}
                className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/20"
              >
                تأكيد وتحويل الرصيد فوراً
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="py-3 px-4 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECENT AGENT TRANSACTIONS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-teal-400" />
          <span>سجل شحنات الوكيل الأخيرة:</span>
        </h3>

        <div className="space-y-2">
          {agentTransactions.slice(0, 6).map((tx) => (
            <div
              key={tx.id}
              className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-bold text-slate-200">{tx.details}</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{tx.timestamp}</div>
              </div>
              <div className="font-mono font-bold text-rose-400 text-sm">
                {tx.coinsDelta.toLocaleString()} عملة
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
