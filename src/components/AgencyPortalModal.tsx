import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Briefcase, Users, Gem, DollarSign, Award, Target, CheckCircle2, UserPlus } from 'lucide-react';

interface AgencyPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgencyPortalModal: React.FC<AgencyPortalModalProps> = ({ isOpen, onClose }) => {
  const { agencies, currentUser, users } = useApp();

  const [activeTab, setActiveTab] = useState<'my_agency' | 'explore' | 'apply'>('my_agency');
  const [selectedAgency, setSelectedAgency] = useState(agencies[0]);

  // Application form state
  const [appName, setAppName] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appExp, setAppExp] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      alert('تم إرسال طلب تأسيس الوكالة بنجاح إلى الإدارة العليا لمراجعته والاعتماد!');
      setSubmitted(false);
      onClose();
    }, 1000);
  };

  const agencyHosts = users.filter((u) => u.agencyId === selectedAgency.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100">
                نظام إدارة الوكالات واستقطاب المضيفين
              </h2>
              <p className="text-xs text-slate-400">
                بناء فرق البث الصوتي، نسب العمولات، ومتابعة الأرباح الشهرية
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('my_agency')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'my_agency'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-slate-850 text-slate-400 hover:text-slate-200'
            }`}
          >
            وكالتي المعتمدة (لوحة التحكم)
          </button>

          <button
            onClick={() => setActiveTab('explore')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'explore'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-850 text-slate-400 hover:text-slate-200'
            }`}
          >
            دليل الوكالات الرسمية
          </button>

          <button
            onClick={() => setActiveTab('apply')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'apply'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'bg-slate-850 text-slate-400 hover:text-slate-200'
            }`}
          >
            التقديم لإنشاء وكالة جديدة
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: MY AGENCY DASHBOARD */}
          {activeTab === 'my_agency' && (
            <div className="space-y-6">
              
              {/* Agency Overview Card */}
              <div className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-3xl shrink-0">
                    {selectedAgency.logo}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-100">{selectedAgency.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                        {selectedAgency.agencyNo}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      المالك المؤسس: <strong className="text-slate-200">{selectedAgency.ownerName}</strong>
                    </div>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400">عدد المضيفين</span>
                    <div className="text-base font-bold text-slate-100 font-mono mt-0.5">
                      {selectedAgency.hostCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400">المتصلون الآن</span>
                    <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                      {selectedAgency.activeHostsCount}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400">إجمالي الألماس</span>
                    <div className="text-base font-bold text-cyan-400 font-mono mt-0.5">
                      {(selectedAgency.totalDiamondsEarned / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400">نسبة العمولة</span>
                    <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                      {selectedAgency.commissionRate}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Target Progress */}
              <div className="p-5 rounded-3xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span>الهدف الشهري للوكالة (8,000,000 ألماس):</span>
                  </span>
                  <span className="font-mono font-bold text-amber-400">
                    {((selectedAgency.totalDiamondsEarned / selectedAgency.targetDiamondsMonthly) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (selectedAgency.totalDiamondsEarned / selectedAgency.targetDiamondsMonthly) * 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>تم تحقيق: {selectedAgency.totalDiamondsEarned.toLocaleString()} ألماس</span>
                  <span>المتبقي للبونص: {(selectedAgency.targetDiamondsMonthly - selectedAgency.totalDiamondsEarned).toLocaleString()} ألماس</span>
                </div>
              </div>

              {/* Hosts Roster List */}
              <div>
                <h4 className="font-bold text-sm text-slate-200 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-400" />
                    <span>قائمة مضيفي الوكالة المعتمدين:</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ساعات البث والأرباح
                  </span>
                </h4>

                <div className="space-y-2.5">
                  {agencyHosts.map((host, idx) => (
                    <div
                      key={host.id}
                      className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={host.avatar}
                          alt={host.displayName}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-400"
                        />
                        <div>
                          <div className="font-bold text-slate-200 flex items-center gap-1.5">
                            <span>{host.displayName}</span>
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px]">
                              VIP {host.vipLevel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            ID: {host.userCode} · المستوى {host.level}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="font-mono font-bold text-cyan-400 text-sm">
                            {host.diamonds.toLocaleString()}
                          </div>
                          <span className="text-[10px] text-slate-400">ألماس مكتسب</span>
                        </div>
                        <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                          نشط في البث
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: EXPLORE AGENCIES */}
          {activeTab === 'explore' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agencies.map((agency) => (
                <div
                  key={agency.id}
                  className="p-5 rounded-3xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-2xl flex items-center justify-center">
                        {agency.logo}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-100">{agency.name}</h4>
                        <span className="text-[10px] font-mono text-amber-400">{agency.agencyNo}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 my-4 text-center">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[9px] text-slate-400">المضيفين</span>
                        <div className="text-xs font-bold text-slate-200 font-mono">{agency.hostCount}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[9px] text-slate-400">العمولة</span>
                        <div className="text-xs font-bold text-amber-400 font-mono">{agency.commissionRate}%</div>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[9px] text-slate-400">أرباح الوكالة</span>
                        <div className="text-xs font-bold text-emerald-400 font-mono">${agency.netProfitsUSD.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      alert(`تم إرسال طلب انضمامك إلى ${agency.name}! سيتواصل معك مالك الوكالة.`);
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                    <span>طلب الانضمام كمضيف</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: APPLY FOR AGENCY */}
          {activeTab === 'apply' && (
            <div className="max-w-md mx-auto space-y-4">
              <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300">
                شروط فتح وكالة: امتلاك خبرة سابقة في استقطاب مذيعين ومضيفين، مع التزام بتحقيق 2,000,000 ألماس شهرياً كحد أدنى.
              </div>

              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    الاسم المقترح للوكالة:
                  </label>
                  <input
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="مثال: وكالة صوت العرب الرسمية"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    رقم الهاتف / واتساب للتواصل:
                  </label>
                  <input
                    type="text"
                    required
                    value={appPhone}
                    onChange={(e) => setAppPhone(e.target.value)}
                    placeholder="+966 50 000 0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    نبذة عن خطتك وعدد المضيفين المتوقع:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={appExp}
                    onChange={(e) => setAppExp(e.target.value)}
                    placeholder="لدي فريق مكون من 15 مضيفاً جاهزاً للبدء..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitted}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-600 text-slate-950 font-black text-sm shadow-xl transition-all"
                >
                  {submitted ? 'جارٍ الإرسال...' : 'إرسال طلب التأسيس للمراجعة'}
                </button>
              </form>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
