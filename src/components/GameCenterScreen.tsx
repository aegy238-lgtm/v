import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Heart,
  MessageCircle,
  Send,
  Gamepad2,
  Plus,
  Sparkles,
  Trophy,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { InteractiveGamesHub } from './InteractiveGamesHub';

interface MomentPost {
  id: string;
  userName: string;
  userAvatar: string;
  timeAgo: string;
  content: string;
  posterUrl?: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
}

export const GameCenterScreen: React.FC = () => {
  const { currentUser, joinRoom, rechargeCoins, setActiveModal } = useApp();
  const [subTab, setSubTab] = useState<'new' | 'hot' | 'following' | 'games'>('hot');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostText, setNewPostText] = useState('');

  const [posts, setPosts] = useState<MomentPost[]>([
    {
      id: 'post_1',
      userName: '😂😂😂😂😂',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      timeAgo: '6h منذ',
      content: 'في مثل بيقولك ياتسترجل وتبقا قدها يتلبس طرحه وتقعد جمبها واااااادببي 😉😜',
      likes: 2,
      comments: 2,
    },
    {
      id: 'post_2',
      userName: 'MOZKA',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      timeAgo: '4h منذ',
      content: 'فقره\nجولة حول العالم مع فريده 😍🇪🇬\nوكاله ابن مصر الساعة 8مساء',
      posterUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80',
      likes: 18,
      comments: 5,
    },
  ]);

  const handleToggleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likes: p.isLiked ? p.likes - 1 : p.likes + 1,
              isLiked: !p.isLiked,
            }
          : p
      )
    );
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;
    setPosts((prev) => [
      {
        id: 'post_' + Date.now(),
        userName: currentUser.displayName,
        userAvatar: currentUser.avatar,
        timeAgo: 'الآن',
        content: newPostText.trim(),
        likes: 1,
        comments: 0,
        isLiked: true,
      },
      ...prev,
    ]);
    setNewPostText('');
    setShowNewPostModal(false);
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gradient-to-b from-[#e8fbf6] via-white to-white text-slate-900 pb-24 font-tajawal select-none shadow-2xl relative">
      
      {/* 1. Top Moments & Games Header (Matching Video 00:38 - 00:41): متابعة | حرارة | جديد + Golden Emblem */}
      <div className="sticky top-0 z-30 bg-[#e8fbf6]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-teal-100/60">
        
        {/* Left: Quick Switch to Full 3D Games Arcade */}
        <button
          onClick={() => setSubTab(subTab === 'games' ? 'hot' : 'games')}
          className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 transition-all ${
            subTab === 'games'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-teal-500/15 text-teal-800 border border-teal-400/40'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>الألعاب</span>
        </button>

        {/* Center Tabs: متابعة | حرارة | جديد */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => setSubTab('following')}
            className={`text-sm font-bold transition-all ${
              subTab === 'following' ? 'text-slate-900 font-black scale-105' : 'text-slate-400'
            }`}
          >
            متابعة
          </button>

          <button
            onClick={() => setSubTab('hot')}
            className={`relative text-lg font-black transition-all ${
              subTab === 'hot'
                ? 'text-slate-900 after:content-[""] after:absolute after:-bottom-1.5 after:inset-x-1 after:h-1 after:rounded-full after:bg-teal-500'
                : 'text-slate-400 text-sm font-bold'
            }`}
          >
            حرارة
          </button>

          <button
            onClick={() => setSubTab('new')}
            className={`text-sm font-bold transition-all ${
              subTab === 'new' ? 'text-slate-900 font-black scale-105' : 'text-slate-400'
            }`}
          >
            جديد
          </button>
        </div>

        {/* Right: Golden Winged Emblem */}
        <button
          onClick={() => joinRoom('room_tyy')}
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-900 via-amber-900 to-amber-500 p-0.5 shadow-md flex items-center justify-center"
        >
          <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center">
            <span className="text-sm leading-none">🦅</span>
            <span className="text-[6px] font-black text-amber-300 uppercase">EMPIRE</span>
          </div>
        </button>
      </div>

      {/* Main Body */}
      {subTab !== 'games' ? (
        <div className="divide-y divide-slate-100">
          {posts.map((post) => (
            <div key={post.id} className="p-4 space-y-3 bg-white">
              
              {/* Post Author Header */}
              <div className="flex items-center justify-end gap-2.5">
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] flex items-center justify-center">
                      ♀
                    </span>
                    <h3 className="text-sm font-black text-slate-900">{post.userName}</h3>
                  </div>
                  <span className="text-[11px] text-slate-400">{post.timeAgo}</span>
                </div>

                <img
                  src={post.userAvatar}
                  alt={post.userName}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-amber-400"
                />
              </div>

              {/* Post Text Content */}
              <p className="text-sm font-bold text-slate-800 text-right whitespace-pre-line leading-relaxed pr-1">
                {post.content}
              </p>

              {/* Optional Promotional Poster Image (Like MOZKA's "جولة حول العالم مع فريدة") */}
              {post.posterUrl && (
                <div
                  onClick={() => joinRoom('room_tyy')}
                  className="relative w-56 ml-auto rounded-2xl overflow-hidden border-2 border-amber-300 shadow-lg cursor-pointer group"
                >
                  <img
                    src={post.posterUrl}
                    alt="جولة حول العالم"
                    className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-between p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/90 text-slate-950 font-black text-[10px] mx-auto">
                      وكالة ابن مصر
                    </span>
                    <div>
                      <div className="text-base font-black text-amber-300 drop-shadow">
                        جولة حول العالم
                      </div>
                      <div className="text-[11px] font-bold text-white">
                        المقدمة مع فريدة 🇪🇬 الساعة 8 مساءً
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Likes & Comments Row */}
              <div className="flex items-center justify-end gap-6 pt-1 text-slate-500 text-xs font-bold">
                <button
                  onClick={() => handleToggleLike(post.id)}
                  className={`flex items-center gap-1.5 ${
                    post.isLiked ? 'text-rose-500 font-black' : 'hover:text-slate-800'
                  }`}
                >
                  <span>{post.likes}</span>
                  <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>

                <button className="flex items-center gap-1.5 hover:text-slate-800">
                  <span>{post.comments}</span>
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>

            </div>
          ))}
        </div>
      ) : (
        /* Interactive 3D Multi-Engine Game Center View */
        <div className="p-3.5 space-y-4 bg-gradient-to-b from-[#1a0f0a] via-[#120804] to-slate-950 min-h-[82vh] rounded-t-3xl text-white">
          <div className="rounded-2xl p-3.5 bg-gradient-to-r from-amber-700/80 via-yellow-600/80 to-amber-800/80 border-2 border-amber-300 text-white flex items-center justify-between shadow-xl">
            <div className="text-right">
              <h3 className="text-sm font-black text-yellow-100">
                مركز الألعاب المتنوعة GAME CENTER
              </h3>
              <p className="text-[11px] text-amber-100 mt-0.5">
                6 ألعاب مختلفة كلياً: الصاروخ، الأسد الجشع، ركلات الترجيح، التنين والنمر، صيد القروش، وبرق زيوس!
              </p>
            </div>
            <span className="text-4xl">🎮</span>
          </div>

          <InteractiveGamesHub
            compact={false}
            onOpenWallet={() => setActiveModal('wallet')}
          />
        </div>
      )}

      {/* Floating Teal Paper-Plane Button at Bottom-Left (Matching Video 00:38 - 00:41) */}
      <button
        onClick={() => setShowNewPostModal(true)}
        className="fixed bottom-20 left-5 z-40 w-13 h-13 rounded-full bg-gradient-to-tr from-teal-400 to-cyan-500 text-white shadow-xl shadow-teal-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        title="نشر لحظة جديدة"
      >
        <Send className="w-6 h-6 -rotate-12" />
      </button>

      {/* Create New Moment Post Modal */}
      {showNewPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-black text-slate-900 text-right">
              نشر لحظة جديدة في المجتمع ✨
            </h3>
            <form onSubmit={handleCreatePost} className="space-y-3">
              <textarea
                rows={3}
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="شارك أصدقاءك يومياتك أو موعد حفلتك القادمة..."
                className="w-full rounded-2xl bg-slate-100 p-3 text-xs text-right text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPostModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white font-black text-xs shadow-md"
                >
                  نشر الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
