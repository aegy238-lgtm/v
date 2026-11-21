import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Heart,
  MessageCircle,
  Send,
  Gamepad2,
  Plus,
  X,
} from 'lucide-react';
import { InteractiveGamesHub } from './InteractiveGamesHub';

interface MomentComment {
  id: string;
  userName: string;
  text: string;
  time: string;
}

interface MomentPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  timeAgo: string;
  content: string;
  likes: number;
  isLiked?: boolean;
  comments: MomentComment[];
}

const MOMENTS_STORAGE_KEY = 'auravoice_real_moments_v1';

export const GameCenterScreen: React.FC = () => {
  const { currentUser, setActiveModal } = useApp();
  const [subTab, setSubTab] = useState<'games' | 'moments'>('games');
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');

  const [posts, setPosts] = useState<MomentPost[]>(() => {
    try {
      const saved = localStorage.getItem(MOMENTS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(MOMENTS_STORAGE_KEY, JSON.stringify(posts));
    } catch {
      // ignore
    }
  }, [posts]);

  const handleToggleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likes: p.isLiked ? Math.max(0, p.likes - 1) : p.likes + 1,
              isLiked: !p.isLiked,
            }
          : p
      )
    );
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;
    const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setPosts((prev) => [
      {
        id: 'post_' + Date.now(),
        userId: currentUser.id,
        userName: currentUser.displayName,
        userAvatar: currentUser.avatar,
        timeAgo: nowTime,
        content: newPostText.trim(),
        likes: 0,
        isLiked: false,
        comments: [],
      },
      ...prev,
    ]);
    setNewPostText('');
    setShowNewPostModal(false);
    setSubTab('moments');
  };

  const handleAddComment = (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...p.comments,
                {
                  id: `c_${Date.now()}`,
                  userName: currentUser.displayName,
                  text: commentInput.trim(),
                  time: nowTime,
                },
              ],
            }
          : p
      )
    );
    setCommentInput('');
  };

  return (
    <div className="min-h-dvh max-w-md mx-auto bg-[#0b101d] text-white pb-24 font-tajawal select-none shadow-2xl relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0b101d]/95 backdrop-blur-md border-b border-white/8 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSubTab('games')}
            className={`relative pb-1 text-sm flex items-center gap-1.5 transition-colors ${
              subTab === 'games'
                ? 'text-amber-300 font-bold after:content-[""] after:absolute after:bottom-[-4px] after:inset-x-0 after:h-[2px] after:bg-amber-400 after:rounded-full'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>مركز الألعاب</span>
          </button>

          <button
            onClick={() => setSubTab('moments')}
            className={`relative pb-1 text-sm transition-colors ${
              subTab === 'moments'
                ? 'text-amber-300 font-bold after:content-[""] after:absolute after:bottom-[-4px] after:inset-x-0 after:h-[2px] after:bg-amber-400 after:rounded-full'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            اللحظات ({posts.length})
          </button>
        </div>

        <button
          onClick={() => setShowNewPostModal(true)}
          className="h-9 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>نشر لحظة</span>
        </button>
      </header>

      {/* Main Content */}
      {subTab === 'games' ? (
        <div className="p-4 space-y-4">
          <div className="rounded-2xl p-3.5 bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3">
            <div className="text-right">
              <h2 className="text-sm font-bold text-amber-300">مركز الألعاب التفاعلية</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                6 أنظمة لعب مختلفة: صاروخ الانفجار، الأسد الجشع، ركلات الترجيح، التنين والنمر، صيد القروش، وبرق زيوس.
              </p>
            </div>
            <span className="text-3xl shrink-0">🎮</span>
          </div>

          <InteractiveGamesHub
            compact={false}
            onOpenWallet={() => setActiveModal('wallet')}
          />
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {posts.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-8 text-center space-y-3">
              <div className="text-3xl">✨</div>
              <p className="text-xs text-slate-300">
                لا توجد لحظات منشورة بعد — شارك أول لحظة لك مع أصدقائك الآن.
              </p>
              <button
                onClick={() => setShowNewPostModal(true)}
                className="h-9 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors"
              >
                + نشر لحظة جديدة
              </button>
            </div>
          ) : (
            posts.map((post) => {
              const isCommenting = activeCommentPostId === post.id;
              return (
                <div
                  key={post.id}
                  className="p-4 rounded-2xl bg-white/[0.04] border border-white/8 space-y-3"
                >
                  {/* Author */}
                  <div className="flex items-center gap-2.5">
                    <img
                      src={post.userAvatar}
                      alt={post.userName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-amber-400/40"
                    />
                    <div className="text-right">
                      <h3 className="text-xs font-bold text-white">{post.userName}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">{post.timeAgo}</span>
                    </div>
                  </div>

                  {/* Body */}
                  <p className="text-xs text-slate-200 text-right whitespace-pre-line leading-relaxed">
                    {post.content}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-5 pt-1 border-t border-white/8 text-xs text-slate-400">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 transition-colors ${
                        post.isLiked ? 'text-rose-400 font-bold' : 'hover:text-white'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-rose-400' : ''}`} />
                      <span className="font-mono tabular-nums">{post.likes}</span>
                    </button>

                    <button
                      onClick={() =>
                        setActiveCommentPostId(isCommenting ? null : post.id)
                      }
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="font-mono tabular-nums">{post.comments.length}</span>
                    </button>
                  </div>

                  {/* Comments Section */}
                  {isCommenting && (
                    <div className="pt-2 space-y-2 border-t border-white/8">
                      {post.comments.map((c) => (
                        <div
                          key={c.id}
                          className="px-3 py-2 rounded-xl bg-white/[0.04] text-right text-xs"
                        >
                          <span className="font-bold text-amber-300 ml-1.5">{c.userName}:</span>
                          <span className="text-slate-200">{c.text}</span>
                        </div>
                      ))}

                      <form
                        onSubmit={(e) => handleAddComment(e, post.id)}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          placeholder="اكتب تعليقاً..."
                          className="flex-1 h-9 rounded-xl bg-white/6 border border-white/12 px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="submit"
                          className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* New Moment Post Modal */}
      {showNewPostModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowNewPostModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#111522] border border-white/12 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">نشر لحظة جديدة</h3>
              <button
                onClick={() => setShowNewPostModal(false)}
                className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3">
              <textarea
                rows={3}
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="شارك أصدقاءك يومياتك أو موعد جلستك الصوتية..."
                className="w-full rounded-2xl bg-white/6 border border-white/12 p-3 text-xs text-right text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPostModal(false)}
                  className="flex-1 h-10 rounded-xl bg-white/8 text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs"
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
