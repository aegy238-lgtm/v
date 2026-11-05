import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Gamepad2, Coins } from 'lucide-react';
import { InteractiveGamesHub } from './InteractiveGamesHub';

interface GameCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GameCenterModal: React.FC<GameCenterModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, setActiveModal } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-tajawal">
      <div className="w-full max-w-md sm:max-w-xl bg-gradient-to-b from-[#2b1708] via-[#1c0f05] to-[#120802] border-t-4 sm:border-2 border-amber-400 rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
        <div className="p-4 border-b border-amber-500/20 bg-black/40 flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 text-stone-300 hover:text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <h2 className="text-sm sm:text-base font-black text-amber-300">
                مركز الألعاب المتنوعة GAME CENTER
              </h2>
              <p className="text-[11px] text-amber-100/80">
                6 ألعاب مختلفة كلياً مع ربح فوري للكوينزات
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-slate-950 flex items-center justify-center shadow-lg">
              <Gamepad2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <InteractiveGamesHub
            compact={false}
            onOpenWallet={() => {
              onClose();
              setActiveModal('wallet');
            }}
          />
        </div>
      </div>
    </div>
  );
};
