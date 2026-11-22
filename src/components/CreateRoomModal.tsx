import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Radio, KeyRound, Image as ImageIcon } from 'lucide-react';
import { VoiceRoom } from '../types';
import midnightLoungeBg from '../assets/images/room_bg_midnight_lounge_1795294231147.jpg';
import royalMajlisBg from '../assets/images/room_bg_royal_majlis_1795294234181.jpg';
import starlightSkyBg from '../assets/images/room_bg_starlight_sky_1795294232054.jpg';

const BUILTIN_ROOM_BACKGROUNDS = [
  { id: 'midnight', nameAr: 'الصالة الليلية', imageUrl: midnightLoungeBg },
  { id: 'majlis', nameAr: 'المجلس الملكي', imageUrl: royalMajlisBg },
  { id: 'starlight', nameAr: 'سماء الليل', imageUrl: starlightSkyBg },
];

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
  const { createVoiceRoom, roomBackgrounds } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<VoiceRoom['category']>('music');
  const [roomType, setRoomType] = useState<VoiceRoom['type']>('public');
  const [password, setPassword] = useState('');
  const [selectedBgId, setSelectedBgId] = useState<string>('midnight');
  const seatCount: VoiceRoom['seatCount'] = 8;

  if (!isOpen) return null;

  const selectedAdminBg = roomBackgrounds.find((b) => b.id === selectedBgId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (roomType === 'password' && !password.trim()) return;

    createVoiceRoom({
      title: title.trim(),
      category,
      type: roomType,
      seatCount,
      password: roomType === 'password' ? password.trim() : undefined,
      backgroundId: selectedBgId,
      backgroundUrl: selectedAdminBg ? selectedAdminBg.imageUrl : undefined,
    });

    setTitle('');
    setPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">إنشاء غرفة صوتية خاصة</h3>
              <p className="text-[11px] text-slate-400">بث مباشر صوتي فوري مع أصدقائك</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              عنوان الغرفة:
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: ديوانية الأصدقاء وطرب المساء 🎶"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              تصنيف الغرفة:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'music', label: 'طرب وموسيقى 🎶' },
                { id: 'chat', label: 'سوالف ودردشة 💬' },
                { id: 'games', label: 'مسابقات وألعاب 🎲' },
                { id: 'vip', label: 'غرفة VIP خاصة 👑' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id as VoiceRoom['category'])}
                  className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                    category === c.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">عدد المايكات:</span>
            <span className="text-amber-300 font-mono font-bold">8 مايكات صوتية (4×2)</span>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              خصوصية الغرفة:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRoomType('public')}
                className={`p-2.5 rounded-xl border font-bold text-center ${
                  roomType === 'public'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                عامة
              </button>
              <button
                type="button"
                onClick={() => setRoomType('password')}
                className={`p-2.5 rounded-xl border font-bold text-center flex items-center justify-center gap-1 ${
                  roomType === 'password'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>برمز مرور</span>
              </button>
              <button
                type="button"
                onClick={() => setRoomType('vip')}
                className={`p-2.5 rounded-xl border font-bold text-center ${
                  roomType === 'vip'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                VIP خاصة
              </button>
            </div>
          </div>

          {roomType === 'password' && (
            <div>
              <label className="block text-amber-300 font-semibold mb-1.5">
                رمز مرور الدخول:
              </label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل رمز الغرفة (مثال: 1234)"
                className="w-full bg-slate-950 border border-amber-500/40 rounded-2xl px-4 py-2.5 font-mono text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>خلفية الغرفة:</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[...roomBackgrounds, ...BUILTIN_ROOM_BACKGROUNDS].map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setSelectedBgId(bg.id)}
                  className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    selectedBgId === bg.id
                      ? 'border-amber-400 ring-2 ring-amber-400/25'
                      : 'border-slate-800 opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={bg.imageUrl}
                    alt={bg.nameAr}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 py-0.5 px-1 bg-black/75 text-[10px] font-bold text-white truncate">
                    {bg.nameAr}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 text-white font-black text-sm shadow-xl shadow-amber-500/25 hover:opacity-95 active:scale-95 transition-all mt-2"
          >
            بدء البث ودخول الغرفة فوراً
          </button>
        </form>

      </div>
    </div>
  );
};
