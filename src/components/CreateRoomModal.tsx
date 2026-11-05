import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Radio, Lock, Users, Sparkles } from 'lucide-react';
import { VoiceRoom } from '../types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
  const { createVoiceRoom } = useApp();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<VoiceRoom['category']>('music');
  const [roomType, setRoomType] = useState<VoiceRoom['type']>('public');
  const [seatCount, setSeatCount] = useState<VoiceRoom['seatCount']>(9);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createVoiceRoom({
      title: title.trim(),
      category,
      type: roomType,
      seatCount,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
        
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
                  onClick={() => setCategory(c.id as any)}
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

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              سعة مقاعد المايك:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[4, 6, 8, 9, 12, 16, 20].slice(0, 4).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setSeatCount(cnt as any)}
                  className={`py-2 rounded-xl border font-mono font-bold transition-all ${
                    seatCount === cnt
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {cnt} مقاعد
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[9, 12, 16].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setSeatCount(cnt as any)}
                  className={`py-2 rounded-xl border font-mono font-bold transition-all ${
                    seatCount === cnt
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {cnt} مقاعد
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              نوع الخصوصية:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRoomType('public')}
                className={`p-2.5 rounded-xl border font-bold text-center ${
                  roomType === 'public'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                غرفة عامة (متاحة للجميع)
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
                غرفة VIP خاصة
              </button>
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
