import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Crown, MessageCircle, Gift, UserPlus, Check, Sparkles, Edit3, ShieldCheck, Shield, Ban } from 'lucide-react';
import { GiftModal } from './GiftModal';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const {
    viewingProfileUser,
    currentUser,
    storeItems,
    users,
    setActiveModal,
    activeRoom,
    isRoomOwner,
    canManageRoom,
    toggleRoomModerator,
    banUserFromRoom,
  } = useApp();

  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [roomActionMsg, setRoomActionMsg] = useState<string | null>(null);

  useEffect(() => {
    setRoomActionMsg(null);
  }, [viewingProfileUser?.id, isOpen]);

  if (!isOpen || !viewingProfileUser) return null;

  const userFrame = viewingProfileUser.activeFrameId
    ? storeItems.find((i) => i.type === 'frame' && i.id === viewingProfileUser.activeFrameId)
    : undefined;

  const isMe = viewingProfileUser.id === currentUser.id;

  const handleSaveBio = () => {
    viewingProfileUser.bio = bioText;
    setIsEditingBio(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        
        {/* Cover Photo */}
        <div className="relative h-28 w-full bg-slate-950">
          <img
            src={viewingProfileUser.coverImage}
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          
          <button
            onClick={onClose}
            className="absolute top-3 left-3 p-1.5 rounded-full bg-slate-950/70 text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Content */}
        <div className="px-6 pb-6 pt-0 relative -mt-12 text-center">
          
          {/* Avatar with Frame */}
          <div className="relative inline-flex items-center justify-center w-28 h-28 mx-auto mb-2">
            <div
              className={
                userFrame?.previewUrl
                  ? 'w-[72px] h-[72px] rounded-full overflow-hidden shadow-2xl'
                  : `w-24 h-24 rounded-full p-1 border-4 ${
                      viewingProfileUser.activeFrameId === 'frame_gold_wings'
                        ? 'border-amber-400 ring-2 ring-yellow-300'
                        : viewingProfileUser.activeFrameId === 'frame_ruby_emperor'
                        ? 'border-rose-500 ring-2 ring-red-400'
                        : viewingProfileUser.activeFrameId
                        ? 'border-cyan-400'
                        : 'border-white/20'
                    } shadow-2xl`
              }
            >
              <img
                src={viewingProfileUser.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            {userFrame?.previewUrl && (
              <img
                src={userFrame.previewUrl}
                alt={userFrame.nameAr}
                referrerPolicy="no-referrer"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[122px] h-[122px] object-contain z-20"
              />
            )}
            {viewingProfileUser.vipLevel > 0 && !userFrame?.previewUrl && (
              <div className="absolute -top-3 inset-x-0 flex justify-center">
                <span className="text-xl">👑</span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 z-30 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px]">
              VIP {viewingProfileUser.vipLevel}
            </div>
          </div>

          <h3 className="font-black text-lg text-slate-100 flex items-center justify-center gap-1.5">
            <span>{viewingProfileUser.displayName}</span>
            <span>{viewingProfileUser.countryFlag}</span>
          </h3>

          <div className="flex items-center justify-center gap-2 text-xs font-mono text-amber-400 mt-0.5">
            <span>ID: {viewingProfileUser.userCode}</span>
            <span>·</span>
            <span className="text-slate-400">المستوى {viewingProfileUser.level}</span>
          </div>

          {/* Agency badge */}
          {viewingProfileUser.agencyName && (
            <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-amber-300">
              <span>⭐</span>
              <span>{viewingProfileUser.agencyName}</span>
            </div>
          )}

          {/* Social Stats Strip */}
          <div className="grid grid-cols-3 gap-2 my-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
            <div>
              <div className="font-mono font-bold text-slate-100 text-sm">
                {viewingProfileUser.followersCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400">المتابعون</span>
            </div>
            <div>
              <div className="font-mono font-bold text-slate-100 text-sm">
                {viewingProfileUser.followingCount}
              </div>
              <span className="text-[10px] text-slate-400">يتابع</span>
            </div>
            <div>
              <div className="font-mono font-bold text-slate-100 text-sm">
                {viewingProfileUser.friendsCount}
              </div>
              <span className="text-[10px] text-slate-400">الأصدقاء</span>
            </div>
          </div>

          {/* Bio */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 text-right">
            <div className="text-[10px] text-slate-400 mb-1 font-bold">النبذة التعريفية (Bio):</div>
            <p className="leading-relaxed">{viewingProfileUser.bio || 'لا توجد نبذة شخصية بعد.'}</p>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex items-center gap-2">
            {!isMe ? (
              <>
                <button
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    isFollowing
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                  }`}
                >
                  {isFollowing ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{isFollowing ? 'تتابعه حالياً' : 'متابعة'}</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    setActiveModal('messages');
                  }}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>محادثة</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setBioText(viewingProfileUser.bio);
                  setIsEditingBio(true);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>تعديل نبذتي الشخصية</span>
              </button>
            )}
          </div>

          {/* Room Owner / Moderator Quick Controls inside Active Room */}
          {activeRoom && !isMe && viewingProfileUser.id !== activeRoom.ownerId && (isRoomOwner(activeRoom) || canManageRoom(activeRoom)) && (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-right">
              <div className="text-[11px] font-bold text-slate-400">
                إدارة العضو داخل الغرفة الحالية ({activeRoom.title})
              </div>
              <div className="flex items-center gap-2">
                {isRoomOwner(activeRoom) && (
                  <button
                    onClick={() => {
                      const res = toggleRoomModerator(activeRoom.id, viewingProfileUser.id);
                      setRoomActionMsg(res.message);
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors ${
                      activeRoom.moderators.includes(viewingProfileUser.id)
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        : 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                    }`}
                  >
                    {activeRoom.moderators.includes(viewingProfileUser.id) ? (
                      <>
                        <Shield className="w-3.5 h-3.5" />
                        <span>سحب إشراف الغرفة</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>منح إشراف الغرفة</span>
                      </>
                    )}
                  </button>
                )}

                {canManageRoom(activeRoom) && (
                  <button
                    onClick={() => {
                      banUserFromRoom(activeRoom.id, viewingProfileUser.id);
                      setRoomActionMsg(`تم حظر ${viewingProfileUser.displayName} من الغرفة`);
                    }}
                    className="py-2.5 px-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>حظر</span>
                  </button>
                )}
              </div>
              {roomActionMsg && (
                <div className="text-[11px] text-emerald-300 font-bold">{roomActionMsg}</div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
