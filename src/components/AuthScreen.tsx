import React, { useEffect, useState } from 'react';
import {
  Mic,
  Radio,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Globe,
  Calendar,
  Sparkles,
  LogOut,
  Headphones,
  Volume2,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VOICE_COUNTRIES, buildVoiceAvatarSvg } from '../utils/voiceProfileOptions';
import loungeBg from '../assets/images/room_bg_midnight_lounge_1795294231147.jpg';

type AuthMode = 'login' | 'register' | 'admin_setup';

export const AuthScreen: React.FC = () => {
  const {
    firebaseUser,
    authLoading,
    authError,
    clearAuthError,
    needsProfileCompletion,
    signInWithGoogleCloud,
    registerWithEmailProfile,
    loginWithEmail,
    completeGoogleOnboardingProfile,
    signOutCloud,
    enterAsGuestDemo,
    adminAuthStatus,
    claimAdminEmailAccount,
  } = useApp();

  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Shared & Registration fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('مدير التطبيق');
  const [selectedCountryName, setSelectedCountryName] = useState('السعودية');
  const [ageInput, setAgeInput] = useState('22');
  const [gender, setGender] = useState<'female' | 'male' | ''>('');

  // Pre-fill Google account display name when entering profile-completion step
  useEffect(() => {
    if (needsProfileCompletion && firebaseUser) {
      if (!displayName.trim() && firebaseUser.displayName) {
        setDisplayName(firebaseUser.displayName);
      }
    }
  }, [needsProfileCompletion, firebaseUser]);

  const selectedCountry =
    VOICE_COUNTRIES.find((c) => c.name === selectedCountryName) || VOICE_COUNTRIES[0];

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError(null);
    clearAuthError();
  };

  const validateProfileFields = (): number | null => {
    if (displayName.trim().length < 2) {
      setLocalError('يرجى إدخال اسم الحساب (حرفان على الأقل).');
      return null;
    }
    const parsedAge = Number(ageInput);
    if (!Number.isFinite(parsedAge) || parsedAge < 13 || parsedAge > 99) {
      setLocalError('يرجى إدخال السن بشكل صحيح (بين 13 و 99 سنة).');
      return null;
    }
    if (gender !== 'female' && gender !== 'male') {
      setLocalError('يرجى تحديد الجنس (أنثى أو ذكر).');
      return null;
    }
    return Math.floor(parsedAge);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!email.trim() || !email.includes('@')) {
      setLocalError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (password.length < 6) {
      setLocalError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }

    await loginWithEmail(email.trim(), password);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const validAge = validateProfileFields();
    if (validAge === null || (gender !== 'female' && gender !== 'male')) return;

    if (!email.trim() || !email.includes('@')) {
      setLocalError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (password.length < 6) {
      setLocalError('كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل.');
      return;
    }

    await registerWithEmailProfile({
      displayName: displayName.trim(),
      email: email.trim(),
      password,
      country: selectedCountry.name,
      countryFlag: selectedCountry.flag,
      age: validAge,
      gender,
      avatar: buildVoiceAvatarSvg(gender, displayName.trim()),
    });
  };

  const handleCompleteGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const validAge = validateProfileFields();
    if (validAge === null || (gender !== 'female' && gender !== 'male')) return;

    await completeGoogleOnboardingProfile({
      displayName: displayName.trim(),
      country: selectedCountry.name,
      countryFlag: selectedCountry.flag,
      age: validAge,
      gender,
      avatar: firebaseUser?.photoURL || buildVoiceAvatarSvg(gender, displayName.trim()),
    });
  };

  const handleAdminSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setLocalError('يرجى إدخال بريد إلكتروني صحيح لحساب المدير.');
      return;
    }
    if (password.length < 6) {
      setLocalError('كلمة سر لوحة التحكم يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('كلمتا المرور غير متطابقتين.');
      return;
    }

    await claimAdminEmailAccount({
      email: cleanEmail,
      password,
      displayName: adminDisplayName.trim() || 'مدير التطبيق',
    });
  };

  const activeError = localError || authError;

  const soundWaveHeights = [18, 34, 52, 28, 64, 44, 72, 38, 56, 26, 48, 30, 60, 24];

  return (
    <div className="min-h-dvh w-full bg-[#070a12] text-slate-100 font-tajawal flex items-stretch justify-center relative overflow-x-hidden">
      {/* Subtle ambient background gradients */}
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 18% 20%, rgba(245, 158, 11, 0.14), transparent 45%), radial-gradient(circle at 82% 78%, rgba(99, 102, 241, 0.16), transparent 48%)',
        }}
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        {/* Voice Chat Brand Showcase Column */}
        <section className="lg:col-span-6 flex flex-col justify-between gap-6">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#0d1221] shadow-2xl">
            <img
              src={loungeBg}
              alt="أجواء غرف الدردشة الصوتية المباشرة"
              className="w-full h-48 sm:h-64 lg:h-80 object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070a12] via-[#070a12]/70 to-transparent" />

            <div className="relative lg:absolute lg:inset-x-0 lg:bottom-0 p-5 sm:p-7 space-y-4">
              <div className="flex items-center gap-3.5">
                <img
                  src="/logo.png"
                  alt="شعار فوكاشات"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-2xl object-cover ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/25 shrink-0"
                />
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    فوكاشات <span className="text-amber-400">VIP</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300">
                    منصة الغرف الصوتية المباشرة والمايكات التفاعلية
                  </p>
                </div>
              </div>

              {/* Acoustic Waveform Visual Motif */}
              <div className="rounded-2xl bg-[#0b101d]/90 border border-white/10 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-300 shrink-0">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white truncate">
                      مجلس الطرب والدردشة الصوتية
                    </div>
                    <div className="text-[11px] text-slate-400">
                      8 مايكات صوتية نقية · هدايا ومنافسات مباشرة
                    </div>
                  </div>
                </div>

                {/* Equalizer Bars */}
                <div className="flex items-end gap-1 h-9 shrink-0" aria-hidden="true">
                  {soundWaveHeights.slice(0, 9).map((h, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full bg-gradient-to-t from-amber-500 to-rose-400"
                      style={{ height: `${Math.max(20, Math.round((h / 72) * 100))}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Voice Room Features Strip (Visible nicely on desktop/tablet) */}
          <div className="hidden sm:grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-[#0d1322]/90 border border-white/10 p-4 space-y-1.5">
              <Headphones className="w-5 h-5 text-amber-400" />
              <div className="text-xs font-black text-white">غرف صوتية حية</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                انضم إلى جلسات السمر والطرب والألعاب الصوتية مع أصدقاء من بلدك.
              </p>
            </div>
            <div className="rounded-2xl bg-[#0d1322]/90 border border-white/10 p-4 space-y-1.5">
              <Volume2 className="w-5 h-5 text-sky-400" />
              <div className="text-xs font-black text-white">هوية صوتية مخصصة</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                علم بلدك وعمرك واسمك الملكي يظهر معك على كل مايك تدخله.
              </p>
            </div>
            <div className="rounded-2xl bg-[#0d1322]/90 border border-white/10 p-4 space-y-1.5">
              <Sparkles className="w-5 h-5 text-rose-400" />
              <div className="text-xs font-black text-white">هدايا ومضاعفات VIP</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                اربح من هدايا الحظ وارتقِ بمستوى الثروة والإطارات الخاصة.
              </p>
            </div>
          </div>
        </section>

        {/* Auth Form Card Column */}
        <section className="lg:col-span-6">
          <div className="rounded-3xl bg-[#0d1322]/95 border border-white/12 p-5 sm:p-8 shadow-2xl space-y-5">
            {needsProfileCompletion && firebaseUser ? (
              /* STEP 2: Profile Completion for Google Users */
              <form onSubmit={handleCompleteGoogleSubmit} className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {firebaseUser.photoURL ? (
                      <img
                        src={firebaseUser.photoURL}
                        alt={firebaseUser.displayName || ''}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-2xl object-cover ring-2 ring-amber-400/70 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                        <UserIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-white truncate">
                        أكمل بيانات ملفك الصوتي
                      </h2>
                      <p className="text-xs text-slate-400 truncate" dir="ltr">
                        {firebaseUser.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOutCloud()}
                    className="min-h-[44px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تبديل</span>
                  </button>
                </div>

                {activeError && (
                  <div className="rounded-2xl bg-rose-500/15 border border-rose-400/40 px-4 py-3 text-xs font-bold text-rose-200 leading-relaxed">
                    {activeError}
                  </div>
                )}

                {/* Account Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    اسم الحساب (يظهر على المايك)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="مثال: سلطان الطرب أو ندى"
                      maxLength={40}
                      required
                      className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Country + Age */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">
                      البلد
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={selectedCountryName}
                        onChange={(e) => setSelectedCountryName(e.target.value)}
                        className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-3 text-sm text-white focus:border-amber-400 focus:outline-none transition-colors"
                      >
                        {VOICE_COUNTRIES.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.flag} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">
                      السن
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-sky-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="number"
                        min={13}
                        max={99}
                        value={ageInput}
                        onChange={(e) => setAgeInput(e.target.value)}
                        placeholder="22"
                        required
                        className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-4 text-sm font-mono tabular-nums text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    الجنس
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`min-h-[48px] rounded-2xl border font-black text-sm flex items-center justify-center gap-2 transition-all ${
                        gender === 'female'
                          ? 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-lg shadow-rose-500/10'
                          : 'bg-slate-950/70 border-white/12 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <span className="text-base">♀</span>
                      <span>أنثى</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`min-h-[48px] rounded-2xl border font-black text-sm flex items-center justify-center gap-2 transition-all ${
                        gender === 'male'
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-lg shadow-sky-500/10'
                          : 'bg-slate-950/70 border-white/12 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <span className="text-base">♂</span>
                      <span>ذكر</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:brightness-105 disabled:opacity-60 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Mic className="w-4 h-4" />
                  <span>{authLoading ? 'جاري الحفظ...' : 'دخول إلى الغرف الصوتية'}</span>
                </button>
              </form>
            ) : (
              /* STEP 1: Login or Create Account */
              <>
                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    {mode === 'login'
                      ? 'تسجيل الدخول إلى فوكاشات'
                      : mode === 'admin_setup'
                      ? 'إعداد حساب المدير الجديد (لوحة التحكم)'
                      : 'إنشاء حساب صوتي جديد'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400">
                    {mode === 'login'
                      ? 'سجّل دخولك للانضمام إلى المايكات والغرف الصوتية المباشرة، أو أدخل بريد المدير للدخول إلى لوحة التحكم.'
                      : mode === 'admin_setup'
                      ? 'تم مسح جميع حسابات المديرين القديمة. أدخل بريدك الإلكتروني النظيف وكلمة السر لتعيين حساب الإدارة الوحيد.'
                      : 'أنشئ هويتك الصوتية واختر بلدك وعمرك للانضمام فوراً.'}
                  </p>
                </div>

                {adminAuthStatus && !adminAuthStatus.configured && mode !== 'admin_setup' && (
                  <div className="rounded-2xl bg-emerald-500/12 border border-emerald-400/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-emerald-100 leading-relaxed">
                        <div className="font-black text-emerald-300">حساب لوحة التحكم جاهز للتعيين النظيف</div>
                        <div className="text-emerald-200/85">تم حذف جميع حسابات المديرين السابقة. أنشئ بريدك الإلكتروني وكلمة السر الآن.</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchMode('admin_setup')}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs shrink-0 transition-colors"
                    >
                      إعداد حساب المدير
                    </button>
                  </div>
                )}

                {/* Mode Tabs */}
                <div
                  className={`grid gap-1.5 p-1 rounded-2xl bg-slate-950/90 border border-white/10 ${
                    adminAuthStatus && !adminAuthStatus.configured ? 'grid-cols-3' : 'grid-cols-2'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-black transition-all ${
                      mode === 'login'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    تسجيل الدخول
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-black transition-all ${
                      mode === 'register'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    حساب جديد
                  </button>
                  {adminAuthStatus && !adminAuthStatus.configured && (
                    <button
                      type="button"
                      onClick={() => switchMode('admin_setup')}
                      className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-black transition-all ${
                        mode === 'admin_setup'
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow'
                          : 'text-emerald-300 hover:text-emerald-200'
                      }`}
                    >
                      حساب المدير
                    </button>
                  )}
                </div>

                {activeError && (
                  <div className="rounded-2xl bg-rose-500/15 border border-rose-400/40 px-4 py-3 text-xs font-bold text-rose-200 leading-relaxed">
                    {activeError}
                  </div>
                )}

                {mode !== 'admin_setup' && (
                  <>
                    {/* Google Sign-In Button */}
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => void signInWithGoogleCloud()}
                      className="w-full min-h-[48px] rounded-2xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-black text-sm flex items-center justify-center gap-3 shadow-lg transition-all"
                    >
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                        />
                      </svg>
                      <span>
                        {mode === 'login' ? 'الدخول السريع بحساب Google' : 'التسجيل السريع بحساب Google'}
                      </span>
                    </button>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <div className="h-px flex-1 bg-white/10" />
                      <span>
                        {mode === 'login'
                          ? 'أو الدخول بالبريد الإلكتروني'
                          : 'أو إنشاء حساب بالبريد الإلكتروني'}
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                  </>
                )}

                {mode === 'admin_setup' ? (
                  <form onSubmit={handleAdminSetupSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        اسم المدير الظاهر في لوحة التحكم
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={adminDisplayName}
                          onChange={(e) => setAdminDisplayName(e.target.value)}
                          placeholder="مدير التطبيق"
                          maxLength={40}
                          required
                          className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        البريد الإلكتروني النظيف للمدير
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          dir="ltr"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@yourdomain.com"
                          required
                          className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none transition-colors text-left"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        كلمة سر لوحة التحكم (6 أحرف على الأقل)
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          dir="ltr"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={6}
                          className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-11 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none transition-colors text-left"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        تأكيد كلمة السر
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          dir="ltr"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={6}
                          className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none transition-colors text-left"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 hover:brightness-105 disabled:opacity-60 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{authLoading ? 'جاري تفعيل حساب المدير...' : 'حفظ ودخول لوحة التحكم فوراً'}</span>
                    </button>
                  </form>
                ) : mode === 'login' ? (
                  <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        البريد الإلكتروني
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          dir="ltr"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          required
                          className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-colors text-left"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        كلمة المرور
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          dir="ltr"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={6}
                          className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-11 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-colors text-left"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:brightness-105 disabled:opacity-60 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                    >
                      <Mic className="w-4 h-4" />
                      <span>{authLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                    {/* Account Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        اسم الحساب
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="الاسم الذي يظهر في الغرف الصوتية"
                          maxLength={40}
                          required
                          className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Country + Age */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1.5">
                          البلد
                        </label>
                        <div className="relative">
                          <Globe className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <select
                            value={selectedCountryName}
                            onChange={(e) => setSelectedCountryName(e.target.value)}
                            className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-3 text-sm text-white focus:border-amber-400 focus:outline-none transition-colors"
                          >
                            {VOICE_COUNTRIES.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.flag} {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1.5">
                          السن
                        </label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 text-sky-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="number"
                            min={13}
                            max={99}
                            value={ageInput}
                            onChange={(e) => setAgeInput(e.target.value)}
                            placeholder="22"
                            required
                            className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-4 text-sm font-mono tabular-nums text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        الجنس
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setGender('female')}
                          className={`min-h-[48px] rounded-2xl border font-black text-sm flex items-center justify-center gap-2 transition-all ${
                            gender === 'female'
                              ? 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-lg shadow-rose-500/10'
                              : 'bg-slate-950/70 border-white/12 text-slate-300 hover:border-white/25'
                          }`}
                        >
                          <span className="text-base">♀</span>
                          <span>أنثى</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setGender('male')}
                          className={`min-h-[48px] rounded-2xl border font-black text-sm flex items-center justify-center gap-2 transition-all ${
                            gender === 'male'
                              ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-lg shadow-sky-500/10'
                              : 'bg-slate-950/70 border-white/12 text-slate-300 hover:border-white/25'
                          }`}
                        >
                          <span className="text-base">♂</span>
                          <span>ذكر</span>
                        </button>
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        البريد الإلكتروني
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          dir="ltr"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          required
                          className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-colors text-left"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        كلمة المرور
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          dir="ltr"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="6 أحرف على الأقل"
                          required
                          minLength={6}
                          className="w-full min-h-[46px] rounded-2xl bg-slate-950/90 border border-white/15 pr-10 pl-11 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-colors text-left"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:brightness-105 disabled:opacity-60 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{authLoading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب ودخول الدردشة'}</span>
                    </button>
                  </form>
                )}

                {/* Guest Preview Option */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={enterAsGuestDemo}
                    className="min-h-[44px] w-full rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>تصفح الغرف كزائر للمعاينة</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
