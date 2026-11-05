import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Shield,
  Users,
  Radio,
  Coins,
  Gem,
  Gift,
  Crown,
  Briefcase,
  CreditCard,
  Search,
  Plus,
  Trash2,
  Lock,
  Unlock,
  VolumeX,
  Volume2,
  CheckCircle,
  AlertTriangle,
  History,
  UserCheck,
} from 'lucide-react';
import { GiftItem, StaffRole } from '../types';

export const AdminDashboard: React.FC = () => {
  const {
    users,
    rooms,
    gifts,
    vipTiers,
    agencies,
    agents,
    staff,
    transactions,
    adminAddBalance,
    adminToggleBan,
    adminToggleMute,
    adminSetVipLevel,
    adminCloseRoom,
    adminCreateGift,
    adminCreateAgent,
    adminTopupAgent,
    adminUpdateAgencyStatus,
    setCurrentView,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'kpi' | 'users' | 'rooms' | 'gifts' | 'agents' | 'agencies' | 'staff' | 'ledger'>('kpi');
  
  // User Search & Balance Adjustment
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [adjustCoins, setAdjustCoins] = useState<number>(100000);
  const [adjustDiamonds, setAdjustDiamonds] = useState<number>(0);
  const [adjustNote, setAdjustNote] = useState('مكافأة داعم / تعويض إداري');

  // New Gift Creation Form
  const [newGiftName, setNewGiftName] = useState('');
  const [newGiftPrice, setNewGiftPrice] = useState(1000);
  const [newGiftDiamonds, setNewGiftDiamonds] = useState(500);
  const [newGiftIcon, setNewGiftIcon] = useState('🌟');
  const [newGiftCat, setNewGiftCat] = useState<'classic' | 'luxury' | 'romantic' | 'magic' | 'vip'>('luxury');
  const [newGiftSound, setNewGiftSound] = useState<'chime' | 'fanfare' | 'roar' | 'magic' | 'laser'>('fanfare');

  // New Agent Form
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentBalance, setNewAgentBalance] = useState(2000000);
  const [newAgentRate, setNewAgentRate] = useState(5);

  const selectedUser = users.find((u) => u.id === selectedUserId) || users[0];

  const filteredUsers = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.userCode.includes(userSearch) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    adminAddBalance(selectedUser.id, adjustCoins, adjustDiamonds, adjustNote);
    alert(`تم تعديل رصيد ${selectedUser.displayName} بنجاح!`);
  };

  const handleCreateGift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGiftName.trim()) return;

    const gift: GiftItem = {
      id: `gift_custom_${Date.now()}`,
      name: newGiftName,
      nameAr: newGiftName,
      category: newGiftCat,
      coinPrice: newGiftPrice,
      diamondReward: newGiftDiamonds,
      icon: newGiftIcon,
      accentColor: '#f59e0b',
      animationType: newGiftCat === 'magic' ? 'explosion' : 'luxury_banner',
      soundEffect: newGiftSound,
      descriptionAr: 'هدية حصرية مضافة حديثاً عبر لوحة التحكم',
    };

    adminCreateGift(gift);
    alert('تمت إضافة الهدية للمتجر فوراً دون الحاجة لتحديث الكود أو التطبيق!');
    setNewGiftName('');
  };

  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    adminCreateAgent({
      name: newAgentName,
      balanceCoins: newAgentBalance,
      commissionRate: newAgentRate,
    });

    alert('تم إنشاء حساب وكيل شحن جديد وتخصيص رصيده بنجاح!');
    setNewAgentName('');
  };

  // Aggregated KPIs
  const totalCoinsInCirculation = users.reduce((acc, u) => acc + u.coins, 0);
  const totalDiamondsInCirculation = users.reduce((acc, u) => acc + u.diamonds, 0);
  const totalRechargeVolume = agents.reduce((acc, a) => acc + a.totalRechargedCoins, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-lg">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-100">لوحة التحكم الرئيسية (Super Admin)</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                تحكم كامل 360°
              </span>
            </div>
            <p className="text-xs text-slate-400">إدارة المستخدمين، الغرف، المتجر، الوكالات، والنظام المالي الشامل</p>
          </div>
        </div>

        <button
          onClick={() => setCurrentView('user_app')}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
        >
          العودة لواجهة المستخدم
        </button>
      </div>

      {/* Admin Nav Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {[
          { id: 'kpi', label: 'الرئيسية والإحصائيات 📊' },
          { id: 'users', label: 'إدارة المستخدمين 👥' },
          { id: 'rooms', label: 'إدارة الغرف الصوتية 🎙️' },
          { id: 'gifts', label: 'إدارة الهدايا والمتجر 🎁' },
          { id: 'agents', label: 'وكلاء الشحن 💳' },
          { id: 'agencies', label: 'نظام الوكالات ⭐' },
          { id: 'staff', label: 'الموظفين والصلاحيات 🛡️' },
          { id: 'ledger', label: 'السجل المالي العام 📋' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: KPI OVERVIEW */}
      {activeTab === 'kpi' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">عدد المستخدمين الإجمالي</span>
              <div className="text-2xl font-black font-mono text-slate-100 mt-1">
                {users.length.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">100% نشطون</span>
            </div>

            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">الغرف الصوتية المفتوحة</span>
              <div className="text-2xl font-black font-mono text-amber-300 mt-1">
                {rooms.length}
              </div>
              <span className="text-[10px] text-slate-400">بث مباشر صوتي</span>
            </div>

            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">إجمالي العملات المتداولة</span>
              <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
                {(totalCoinsInCirculation / 1000000).toFixed(2)}M
              </div>
              <span className="text-[10px] text-slate-400">في محافظ المستخدمين</span>
            </div>

            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">إجمالي شحن الوكلاء</span>
              <div className="text-2xl font-black font-mono text-rose-300 mt-1">
                {(totalRechargeVolume / 1000000).toFixed(1)}M
              </div>
              <span className="text-[10px] text-slate-400">عمليات معتمدة</span>
            </div>

          </div>

          {/* Lucky Gifts & Multipliers Live Control Center */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-pink-950/50 border border-amber-500/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍭</span>
                <div>
                  <h3 className="text-sm font-black text-amber-300">
                    محرك التحكم في مضاعفات هدايا الحظ (Lucky Lollipop Multipliers)
                  </h3>
                  <p className="text-xs text-slate-400">
                    تحكم مباشر في نسب ظهور مضاعفات 8X و 66X و 188X و 250X وصندوق الهدايا الملكي داخل الغرف
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-black">
                نشط في جميع الغرف ●
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30">
                <span className="text-[11px] text-slate-400 block">نسبة مضاعف 8X - 18X</span>
                <span className="text-lg font-black text-amber-300 font-mono">75%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30">
                <span className="text-[11px] text-slate-400 block">نسبة مضاعف 66X</span>
                <span className="text-lg font-black text-pink-400 font-mono">18%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30">
                <span className="text-[11px] text-slate-400 block">نسبة مضاعف 188X - 250X</span>
                <span className="text-lg font-black text-cyan-300 font-mono">7%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30">
                <span className="text-[11px] text-slate-400 block">هدف صندوق الكنز الملكي</span>
                <span className="text-lg font-black text-emerald-400 font-mono">60.00M 🪙</span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <h3 className="font-bold text-sm text-slate-200">الوكالات المسجلة</h3>
              <p className="text-xs text-slate-400">
                {agencies.length} وكالات رسمية تدر أرباحاً شهرية تقدر بـ $96,000 USD
              </p>
              <button
                onClick={() => setActiveTab('agencies')}
                className="mt-2 text-xs font-bold text-indigo-400 hover:underline"
              >
                متابعة الوكالات والمضيفين ←
              </button>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <h3 className="font-bold text-sm text-slate-200">كتالوج الهدايا التفاعلية</h3>
              <p className="text-xs text-slate-400">
                {gifts.length} هدايا نشطة في الغرف تدعم الرسوم المتحركة ومؤثرات الصوت
              </p>
              <button
                onClick={() => setActiveTab('gifts')}
                className="mt-2 text-xs font-bold text-amber-400 hover:underline"
              >
                إضافة أو تعديل أسعار الهدايا ←
              </button>
            </div>

            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <h3 className="font-bold text-sm text-slate-200">فريق العمل والصلاحيات</h3>
              <p className="text-xs text-slate-400">
                {staff.length} موظفين موزعون على 8 مستويات إدارية بسجل تدقيق مستقل
              </p>
              <button
                onClick={() => setActiveTab('staff')}
                className="mt-2 text-xs font-bold text-purple-400 hover:underline"
              >
                إدارة الصلاحيات والمشرفين ←
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* User List & Search (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="بحث برقم ID أو الاسم..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl ltr:pl-9 rtl:pr-9 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsers.map((u) => {
                const isSelected = selectedUserId === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          <span>{u.displayName}</span>
                          <span className="text-[10px] text-amber-400">VIP {u.vipLevel}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">ID: {u.userCode}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-amber-400">{u.coins.toLocaleString()}</div>
                      <span className="text-[9px] text-slate-500">عملة</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Operations Panel (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
            {selectedUser ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedUser.avatar}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-400"
                    />
                    <div>
                      <h3 className="font-black text-base text-slate-100">{selectedUser.displayName}</h3>
                      <div className="text-xs text-amber-400 font-mono">
                        ID: {selectedUser.userCode} · المستوى {selectedUser.level} · VIP {selectedUser.vipLevel}
                      </div>
                    </div>
                  </div>

                  {/* Ban / Mute Toggles */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adminToggleMute(selectedUser.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        selectedUser.isMuted
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {selectedUser.isMuted ? 'إلغاء الكتم' : 'كتم المستخدم'}
                    </button>

                    <button
                      onClick={() => adminToggleBan(selectedUser.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        selectedUser.isBanned
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:text-rose-400'
                      }`}
                    >
                      {selectedUser.isBanned ? 'فك الحظر' : 'حظر الحساب'}
                    </button>
                  </div>
                </div>

                {/* VIP Level Override */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    تعيين رتبة VIP فورياً (بدون تكلفة):
                  </label>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {[0, 1, 3, 5, 7, 10, 12, 15].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => adminSetVipLevel(selectedUser.id, lvl)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                          selectedUser.vipLevel === lvl
                            ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        VIP {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Balance Modification Form */}
                <form onSubmit={handleAdjustBalance} className="space-y-4 pt-3 border-t border-slate-800">
                  <h4 className="font-bold text-xs text-slate-200">تعديل رصيد المحفظة بصلاحية إدارية:</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        العملات الذهبية (+ أو -):
                      </label>
                      <input
                        type="number"
                        step="10000"
                        value={adjustCoins}
                        onChange={(e) => setAdjustCoins(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        الألماس (+ أو -):
                      </label>
                      <input
                        type="number"
                        step="5000"
                        value={adjustDiamonds}
                        onChange={(e) => setAdjustDiamonds(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      سبب التعديل (يسجل في سجل المراقبة الإداري):
                    </label>
                    <input
                      type="text"
                      required
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-colors"
                  >
                    تطبيق التعديل المالي في المحفظة
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">اختر مستخدماً من القائمة</div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: ROOMS MANAGEMENT */}
      {activeTab === 'rooms' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-amber-400">ID: {room.roomNo}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {room.seatCount} مقاعد
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-100">{room.title}</h4>
                  <div className="text-xs text-slate-400 mt-1">المالك: {room.ownerName}</div>
                  <div className="text-xs text-cyan-400 font-mono mt-1">
                    المتواجدين: {room.onlineViewersCount} مستخدم
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    الألماس: {(room.totalDiamondsEarned / 1000).toFixed(0)}K
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من إغلاق الغرفة (${room.title})؟`)) {
                        adminCloseRoom(room.id);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold"
                  >
                    إغلاق الغرفة إدارياً
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: GIFTS & STORE MANAGEMENT */}
      {activeTab === 'gifts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* New Gift Form (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>إضافة هدية جديدة للمتجر فوراً</span>
            </h3>

            <form onSubmit={handleCreateGift} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">اسم الهدية:</label>
                <input
                  type="text"
                  required
                  value={newGiftName}
                  onChange={(e) => setNewGiftName(e.target.value)}
                  placeholder="مثال: تاج الأساطير الذهبي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">الأيقونة (رمز/إيموجي):</label>
                  <input
                    type="text"
                    required
                    value={newGiftIcon}
                    onChange={(e) => setNewGiftIcon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">التصنيف:</label>
                  <select
                    value={newGiftCat}
                    onChange={(e) => setNewGiftCat(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="classic">كلاسيكية</option>
                    <option value="luxury">فاخرة</option>
                    <option value="romantic">رومانسية</option>
                    <option value="magic">سحرية SVGA</option>
                    <option value="vip">VIP حصري</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">سعر العملات:</label>
                  <input
                    type="number"
                    step="100"
                    value={newGiftPrice}
                    onChange={(e) => setNewGiftPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">عائد الألماس:</label>
                  <input
                    type="number"
                    step="50"
                    value={newGiftDiamonds}
                    onChange={(e) => setNewGiftDiamonds(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-cyan-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">المؤثر الصوتي:</label>
                <select
                  value={newGiftSound}
                  onChange={(e) => setNewGiftSound(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="fanfare">أبواق النصر الملكية</option>
                  <option value="roar">زئير التنين الأسطوري</option>
                  <option value="magic">سحر الفضاء والنجوم</option>
                  <option value="chime">رنين الأجراس الذهبية</option>
                  <option value="laser">صاروخ المجرة</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
              >
                نشر الهدية في المتجر فوراً
              </button>
            </form>
          </div>

          {/* Active Gifts Catalog (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <h3 className="font-bold text-sm text-slate-200">الهدايا المفعلة حالياً في النظام ({gifts.length}):</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto">
              {gifts.map((g) => (
                <div
                  key={g.id}
                  className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center text-xs"
                >
                  <span className="text-3xl my-1">{g.icon}</span>
                  <div className="font-bold text-slate-200 truncate w-full">{g.nameAr}</div>
                  <div className="font-mono text-amber-400 font-bold mt-1">
                    {g.coinPrice.toLocaleString()} عملة
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 5: RECHARGE AGENTS MANAGEMENT */}
      {activeTab === 'agents' && (
        <div className="space-y-6">
          
          {/* Create Agent Box */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800">
            <h3 className="font-bold text-sm text-slate-200 mb-3">تأسيس وكيل شحن جديد وتخصيص رصيده:</h3>
            <form onSubmit={handleCreateAgent} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="اسم الوكيل / المكتب"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
              />
              <input
                type="number"
                step="500000"
                value={newAgentBalance}
                onChange={(e) => setNewAgentBalance(Number(e.target.value))}
                placeholder="الرصيد المبدئي"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-teal-500"
              />
              <input
                type="number"
                step="0.5"
                value={newAgentRate}
                onChange={(e) => setNewAgentRate(Number(e.target.value))}
                placeholder="نسبة العمولة %"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono focus:outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                className="py-2 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
              >
                إنشاء واعتماد الوكيل
              </button>
            </form>
          </div>

          {/* Agents List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {agents.map((ag) => (
              <div
                key={ag.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-100">{ag.name}</span>
                    <span className="text-xs font-mono text-teal-400">{ag.agentCode}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 my-3 text-center text-xs">
                    <div className="p-2 rounded-xl bg-slate-950">
                      <span className="text-[10px] text-slate-400">الرصيد المتاح</span>
                      <div className="font-mono font-bold text-amber-300">
                        {ag.balanceCoins.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950">
                      <span className="text-[10px] text-slate-400">إجمالي الشحن</span>
                      <div className="font-mono font-bold text-slate-200">
                        {ag.totalRechargedCoins.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950">
                      <span className="text-[10px] text-slate-400">العمولة</span>
                      <div className="font-mono font-bold text-emerald-400">
                        {ag.commissionRate}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      adminTopupAgent(ag.id, 1000000);
                      alert(`تمت إضافة 1,000,000 عملة لرصيد الوكيل ${ag.name}!`);
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-bold transition-colors"
                  >
                    + شحن 1,000,000 عملة إضافية للوكيل
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 6: AGENCIES MANAGEMENT */}
      {activeTab === 'agencies' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {agencies.map((agency) => (
            <div
              key={agency.id}
              className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{agency.logo}</span>
                    <h4 className="font-bold text-sm text-slate-100">{agency.name}</h4>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      agency.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {agency.status === 'active' ? 'نشطة ومعتمدة' : 'معلقة'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-2">المالك: {agency.ownerName}</div>
                <div className="text-xs text-amber-400 mt-0.5">نسبة العمولة المقررة: {agency.commissionRate}%</div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span>المضيفين: {agency.hostCount}</span>
                <button
                  onClick={() => {
                    const nextStatus = agency.status === 'active' ? 'suspended' : 'active';
                    adminUpdateAgencyStatus(agency.id, nextStatus);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  {agency.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل الوكالة'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 7: STAFF ROLES & PERMISSIONS */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
            نظام الصلاحيات الموزعة (RBAC): كل موظف يمتلك حساباً مستقلاً وكلمة مرور وصلاحيات مقيدة حسب دوره الوظيفي.
          </div>

          <div className="space-y-3">
            {staff.map((member) => (
              <div
                key={member.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-indigo-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-100">{member.name}</div>
                    <div className="text-slate-400">@{member.username} · آخر نشاط: {member.lastActive}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-xs">
                    {member.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: FINANCIAL LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>السجل المالي العام للعمليات (Audit Trail):</span>
          </h3>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-200">{tx.details}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    بواسطة: {tx.userName} · {tx.timestamp}
                  </div>
                </div>

                <div className="text-right">
                  {tx.coinsDelta !== 0 && (
                    <div
                      className={`font-mono font-bold ${
                        tx.coinsDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.coinsDelta > 0 ? `+${tx.coinsDelta.toLocaleString()}` : tx.coinsDelta.toLocaleString()} عملة
                    </div>
                  )}
                  {tx.diamondsDelta !== 0 && (
                    <div className="font-mono font-bold text-cyan-400">
                      {tx.diamondsDelta > 0 ? `+${tx.diamondsDelta.toLocaleString()}` : tx.diamondsDelta.toLocaleString()} ألماس
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
