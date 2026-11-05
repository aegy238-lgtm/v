import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { RotateCcw, Coins, Sparkles, Trophy, Flame, Zap, Target } from 'lucide-react';
import confetti from 'canvas-confetti';

export type GameEngineType =
  | 'crash_rocket'
  | 'greedy_lion'
  | 'penalty_kick'
  | 'dragon_tiger'
  | 'ocean_hunt'
  | 'zeus_slots';

export interface GameCatalogItem {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  bg: string;
  engine: GameEngineType;
  badge?: string;
}

export const FULL_GAMES_CATALOG: GameCatalogItem[] = [
  { id: 'rocket2', name: 'Rocket Crash', nameAr: 'صاروخ الانفجار', icon: '🚀', bg: 'from-indigo-600 to-slate-900', engine: 'crash_rocket', badge: 'HOT 🔥' },
  { id: 'lion_greedy', name: 'LionGreedy', nameAr: 'الأسد الجشع', icon: '🦁', bg: 'from-orange-500 to-red-900', engine: 'greedy_lion', badge: '45X' },
  { id: 'bounty', name: 'BountyFootball', nameAr: 'ركلات الترجيح', icon: '⚽', bg: 'from-emerald-600 to-green-900', engine: 'penalty_kick', badge: 'جديد' },
  { id: 'dragon_tiger', name: 'Dragon Tiger', nameAr: 'التنين والنمر', icon: '🐉', bg: 'from-red-600 to-yellow-900', engine: 'dragon_tiger', badge: 'VIP' },
  { id: 'fish_hunt', name: 'OceanKing2', nameAr: 'صيد القروش', icon: '🦈', bg: 'from-cyan-500 to-blue-900', engine: 'ocean_hunt', badge: '25X' },
  { id: 'zeus', name: 'Zeus Lightning', nameAr: 'برق زيوس', icon: '⚡', bg: 'from-sky-500 to-blue-950', engine: 'zeus_slots', badge: '100X' },
  { id: 'super_ace', name: 'SuperAce', nameAr: 'سوبر آيس ورق', icon: '🃏', bg: 'from-amber-500 to-yellow-800', engine: 'dragon_tiger' },
  { id: 'animal_slot', name: 'AnimalSlot', nameAr: 'عجلة الحيوانات', icon: '🐼', bg: 'from-orange-500 to-amber-900', engine: 'greedy_lion' },
  { id: 'mahjong', name: 'Mahjong2', nameAr: 'ماهجونغ الذهبية', icon: '🀄', bg: 'from-red-600 to-rose-950', engine: 'zeus_slots' },
  { id: 'treasure_rain', name: 'Treasure Rain', nameAr: 'مطر الكنوز', icon: '🪙', bg: 'from-yellow-500 to-amber-800', engine: 'ocean_hunt' },
  { id: 'lucky77', name: 'Lucky 77', nameAr: 'لاكي 77', icon: '7️⃣', bg: 'from-amber-400 to-red-800', engine: 'zeus_slots' },
  { id: 'rocket1', name: 'Space UFO', nameAr: 'سفينة الفضاء', icon: '🛸', bg: 'from-blue-600 to-indigo-950', engine: 'crash_rocket' },
  { id: 'magic_slot', name: 'MagicSlot', nameAr: 'القبعة السحرية', icon: '🎩', bg: 'from-purple-600 to-indigo-950', engine: 'ocean_hunt' },
  { id: 'perfect_shot', name: 'PerfectShot', nameAr: 'التسديدة الذهبية', icon: '🎱', bg: 'from-teal-500 to-emerald-900', engine: 'penalty_kick' },
  { id: 'ghost_pirate', name: 'GhostPirate', nameAr: 'كنز القراصنة', icon: '🏴‍☠️', bg: 'from-slate-600 to-slate-950', engine: 'ocean_hunt' },
  { id: 'fruit_party', name: 'Fruit Party', nameAr: 'حفلة الفواكه', icon: '🍓', bg: 'from-pink-500 to-rose-900', engine: 'greedy_lion' },
  { id: 'ocean_king2', name: 'Whale Hunt', nameAr: 'الحوت الأزرق', icon: '🐳', bg: 'from-blue-400 to-indigo-900', engine: 'ocean_hunt' },
  { id: 'maya_quest', name: 'Maya Quest', nameAr: 'أسرار المايا', icon: '🗿', bg: 'from-amber-600 to-stone-900', engine: 'zeus_slots' },
  { id: 'gold_py', name: 'Pharaoh Gold', nameAr: 'أهرامات الذهب', icon: '🔺', bg: 'from-yellow-400 to-amber-900', engine: 'zeus_slots' },
  { id: 'glod_moo', name: 'GoldMoon', nameAr: 'القمر الذهبي', icon: '🌕', bg: 'from-purple-500 to-slate-900', engine: 'crash_rocket' },
  { id: 'fresh_fort', name: 'Melon Wheel', nameAr: 'عجلة البطيخ', icon: '🍉', bg: 'from-lime-500 to-emerald-900', engine: 'greedy_lion' },
  { id: 'gems', name: 'Fortune Gems', nameAr: 'جوهرة الثروة', icon: '💎', bg: 'from-fuchsia-500 to-purple-950', engine: 'ocean_hunt' },
  { id: 'crazy_hunt', name: 'Dino Hunt', nameAr: 'صيد الديناصور', icon: '🦖', bg: 'from-emerald-500 to-teal-950', engine: 'ocean_hunt' },
  { id: 'pinata', name: 'Pinata Win', nameAr: 'بيناتا الحظ', icon: '🦄', bg: 'from-pink-400 to-purple-900', engine: 'penalty_kick' },
  { id: 'lucky777', name: 'Lucky777', nameAr: 'جاكبوت 777', icon: '🎰', bg: 'from-amber-500 to-red-950', engine: 'zeus_slots' },
  { id: 'colosseum', name: 'Colosseum', nameAr: 'فرسان روما', icon: '🏛️', bg: 'from-stone-500 to-stone-900', engine: 'dragon_tiger' },
  { id: 'blackjack', name: 'Blackjack', nameAr: 'بلاك جاك 21', icon: '♠️', bg: 'from-emerald-700 to-slate-950', engine: 'dragon_tiger' },
  { id: 'titanic', name: 'Titanic', nameAr: 'سفينة تيتانيك', icon: '🚢', bg: 'from-sky-700 to-slate-950', engine: 'crash_rocket' },
  { id: 'roulette', name: 'Roulette', nameAr: 'الروليت الملكي', icon: '🎡', bg: 'from-red-700 to-amber-950', engine: 'greedy_lion' },
  { id: 'greedy_cat', name: 'Greedy Cat', nameAr: 'القطة الجشعة', icon: '🐱', bg: 'from-amber-400 to-orange-900', engine: 'greedy_lion' },
];

interface InteractiveGamesHubProps {
  compact?: boolean;
  initialGameId?: string | null;
  onWinAnnouncement?: (gameName: string, gameIcon: string, winCoins: number, multiplier: number) => void;
  onOpenWallet?: () => void;
}

export const InteractiveGamesHub: React.FC<InteractiveGamesHubProps> = ({
  compact = false,
  initialGameId = null,
  onWinAnnouncement,
  onOpenWallet,
}) => {
  const { currentUser, rechargeCoins, setActiveModal } = useApp();

  const [selectedGame, setSelectedGame] = useState<GameCatalogItem | null>(() => {
    if (!initialGameId) return null;
    return FULL_GAMES_CATALOG.find((g) => g.id === initialGameId) || null;
  });

  const [betAmount, setBetAmount] = useState<number>(500);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // =========================================================================
  // ENGINE 1: CRASH ROCKET (صاروخ الانفجار)
  // =========================================================================
  const [rocketState, setRocketState] = useState<'idle' | 'flying' | 'crashed' | 'cashed_out'>('idle');
  const [rocketMultiplier, setRocketMultiplier] = useState<number>(1.0);
  const rocketCrashPointRef = useRef<number>(2.5);
  const rocketTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rocketTimerRef.current) window.clearInterval(rocketTimerRef.current);
    };
  }, []);

  const startCrashRocket = () => {
    if (rocketState === 'flying') return;
    if (currentUser.coins < betAmount) {
      setStatusMessage('رصيد الكوينز غير كافٍ! اشحن محفظتك 🪙');
      return;
    }
    rechargeCoins(-betAmount, `رهان ${selectedGame?.nameAr || 'الصاروخ'}`);
    setStatusMessage(null);
    setRocketMultiplier(1.0);
    setRocketState('flying');

    // Random crash point between 1.15x and 18.0x
    const roll = Math.random();
    rocketCrashPointRef.current =
      roll < 0.2 ? 1.15 + Math.random() * 0.4 : roll < 0.75 ? 1.6 + Math.random() * 3.5 : 5.0 + Math.random() * 15.0;

    if (rocketTimerRef.current) window.clearInterval(rocketTimerRef.current);
    rocketTimerRef.current = window.setInterval(() => {
      setRocketMultiplier((prev) => {
        const next = Number((prev + prev * 0.045 + 0.02).toFixed(2));
        if (next >= rocketCrashPointRef.current) {
          if (rocketTimerRef.current) window.clearInterval(rocketTimerRef.current);
          setRocketState('crashed');
          setStatusMessage(`💥 انفجر الصاروخ عند ${rocketCrashPointRef.current.toFixed(2)}X! حاول مرة أخرى`);
          return Number(rocketCrashPointRef.current.toFixed(2));
        }
        return next;
      });
    }, 90);
  };

  const cashOutRocket = () => {
    if (rocketState !== 'flying') return;
    if (rocketTimerRef.current) window.clearInterval(rocketTimerRef.current);
    setRocketState('cashed_out');
    const winCoins = Math.round(betAmount * rocketMultiplier);
    rechargeCoins(winCoins, `ربح صاروخ ${rocketMultiplier}X`);
    confetti({ particleCount: 55, spread: 70, origin: { y: 0.6 } });
    setStatusMessage(`🎉 سحبت في الوقت المناسب! ربحت ${winCoins.toLocaleString()} كوينز (${rocketMultiplier}X)!`);
    onWinAnnouncement?.(
      selectedGame?.nameAr || 'صاروخ الانفجار',
      selectedGame?.icon || '🚀',
      winCoins,
      Number(rocketMultiplier.toFixed(1))
    );
  };

  // =========================================================================
  // ENGINE 2: GREEDY LION / 8-BOX TURNTABLE (الأسد الجشع وعجلة الفواكه)
  // =========================================================================
  const greedyItems = [
    { id: 'lion', name: 'الأسد', icon: '🦁', mult: 45, color: 'from-amber-500 to-red-700' },
    { id: 'panda', name: 'الباندا', icon: '🐼', mult: 25, color: 'from-emerald-500 to-teal-800' },
    { id: 'monkey', name: 'القرد', icon: '🐵', mult: 15, color: 'from-orange-400 to-amber-800' },
    { id: 'rabbit', name: 'الأرنب', icon: '🐰', mult: 10, color: 'from-pink-400 to-rose-800' },
    { id: 'strawberry', name: 'فراولة', icon: '🍓', mult: 5, color: 'from-rose-500 to-red-900' },
    { id: 'melon', name: 'بطيخ', icon: '🍉', mult: 5, color: 'from-green-500 to-emerald-900' },
    { id: 'grapes', name: 'عنب', icon: '🍇', mult: 5, color: 'from-purple-500 to-indigo-900' },
    { id: 'cherry', name: 'كرز', icon: '🍒', mult: 5, color: 'from-red-500 to-rose-950' },
  ];
  const [selectedGreedyBets, setSelectedGreedyBets] = useState<string[]>(['lion', 'panda', 'strawberry']);
  const [activeTurntableIdx, setActiveTurntableIdx] = useState<number>(0);
  const [isTurntableSpinning, setIsTurntableSpinning] = useState<boolean>(false);

  const spinGreedyLion = () => {
    if (isTurntableSpinning) return;
    if (selectedGreedyBets.length === 0) {
      setStatusMessage('اختر حيواناً أو فاكهة واحدة على الأقل للرهان عليها!');
      return;
    }
    const totalCost = betAmount * selectedGreedyBets.length;
    if (currentUser.coins < totalCost) {
      setStatusMessage(`تحتاج ${totalCost.toLocaleString()} كوينز لتغطية اختياراتك!`);
      return;
    }

    rechargeCoins(-totalCost, `رهان ${selectedGame?.nameAr || 'الأسد الجشع'}`);
    setIsTurntableSpinning(true);
    setStatusMessage('العجلة تدور حول المربعات...');

    // Weighted random winner so fruits win often and Lion/Panda give massive jackpots
    const weights = [4, 7, 10, 14, 17, 16, 16, 16];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    let targetIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        targetIdx = i;
        break;
      }
    }

    const totalSteps = 24 + targetIdx;
    let step = 0;
    const stepInterval = window.setInterval(() => {
      setActiveTurntableIdx(step % 8);
      step++;
      if (step > totalSteps) {
        window.clearInterval(stepInterval);
        setIsTurntableSpinning(false);
        const winner = greedyItems[targetIdx];
        if (selectedGreedyBets.includes(winner.id)) {
          const winCoins = betAmount * winner.mult;
          rechargeCoins(winCoins, `فوز ${winner.name}`);
          confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
          setStatusMessage(`🎉 توقف المؤشر على ${winner.icon} ${winner.name}! ربحت ${winCoins.toLocaleString()} كوينز (${winner.mult}X)!`);
          onWinAnnouncement?.(
            selectedGame?.nameAr || 'الأسد الجشع',
            winner.icon,
            winCoins,
            winner.mult
          );
        } else {
          setStatusMessage(`توقف المؤشر على ${winner.icon} ${winner.name} (${winner.mult}X). جرب مرة أخرى!`);
        }
      }
    }, 85);
  };

  // =========================================================================
  // ENGINE 3: PENALTY SHOOTOUT (ركلات الترجيح)
  // =========================================================================
  const goalCorners = [
    { id: 'top_right', label: 'مقص يمين ↗️', mult: 3.5 },
    { id: 'top_center', label: 'منتصف عالي ⬆️', mult: 2.2 },
    { id: 'top_left', label: 'مقص يسار ↖️', mult: 3.5 },
    { id: 'bot_right', label: 'أرضية يمين ↘️', mult: 2.5 },
    { id: 'bot_left', label: 'أرضية يسار ↙️', mult: 2.5 },
  ];
  const [keeperCorner, setKeeperCorner] = useState<string | null>(null);
  const [ballCorner, setBallCorner] = useState<string | null>(null);
  const [isShootingBall, setIsShootingBall] = useState<boolean>(false);

  const shootPenalty = (cornerId: string, mult: number) => {
    if (isShootingBall) return;
    if (currentUser.coins < betAmount) {
      setStatusMessage('رصيد الكوينز غير كافٍ للتسديد!');
      return;
    }
    rechargeCoins(-betAmount, 'رهان ركلات الترجيح');
    setIsShootingBall(true);
    setBallCorner(cornerId);
    setKeeperCorner(null);
    setStatusMessage('تسديدة قوية نحو المرمى... ⚽');

    setTimeout(() => {
      const allCornerIds = goalCorners.map((c) => c.id);
      // Keeper dives to a random corner (65% chance player scores!)
      const otherCorners = allCornerIds.filter((id) => id !== cornerId);
      const doesScore = Math.random() < 0.65;
      const diveCorner = doesScore
        ? otherCorners[Math.floor(Math.random() * otherCorners.length)]
        : cornerId;

      setKeeperCorner(diveCorner);
      setIsShootingBall(false);

      if (doesScore) {
        const winCoins = Math.round(betAmount * mult);
        rechargeCoins(winCoins, 'هدف ركلات الترجيح');
        confetti({ particleCount: 50, spread: 65, origin: { y: 0.6 } });
        setStatusMessage(`⚽ جوووول عالمي! الحارس قفز للجهة الأخرى وربحت ${winCoins.toLocaleString()} كوينز (${mult}X)!`);
        onWinAnnouncement?.(
          selectedGame?.nameAr || 'ركلات الترجيح',
          '⚽',
          winCoins,
          mult
        );
      } else {
        setStatusMessage('🧤 تصدى لها الحارس ببراعة! سدد في زاوية أخرى');
      }
    }, 550);
  };

  // =========================================================================
  // ENGINE 4: DRAGON VS TIGER (معركة التنين والنمر)
  // =========================================================================
  const [dtChoice, setDtChoice] = useState<'dragon' | 'tie' | 'tiger'>('dragon');
  const [dragonCard, setDragonCard] = useState<{ num: number; label: string } | null>(null);
  const [tigerCard, setTigerCard] = useState<{ num: number; label: string } | null>(null);
  const [isDealingCards, setIsDealingCards] = useState<boolean>(false);

  const dealDragonTiger = () => {
    if (isDealingCards) return;
    if (currentUser.coins < betAmount) {
      setStatusMessage('رصيد الكوينز غير كافٍ!');
      return;
    }
    rechargeCoins(-betAmount, 'رهان التنين والنمر');
    setIsDealingCards(true);
    setDragonCard(null);
    setTigerCard(null);
    setStatusMessage('جاري سحب وكشف الأوراق الملكية... 🃏');

    const cardLabels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    setTimeout(() => {
      const dVal = Math.floor(Math.random() * 13) + 1;
      const tVal = Math.floor(Math.random() * 13) + 1;
      setDragonCard({ num: dVal, label: cardLabels[dVal - 1] });
      setTigerCard({ num: tVal, label: cardLabels[tVal - 1] });
      setIsDealingCards(false);

      const outcome = dVal > tVal ? 'dragon' : tVal > dVal ? 'tiger' : 'tie';
      if (outcome === dtChoice) {
        const mult = outcome === 'tie' ? 11 : 2;
        const winCoins = betAmount * mult;
        rechargeCoins(winCoins, 'فوز التنين والنمر');
        confetti({ particleCount: 55, spread: 70, origin: { y: 0.6 } });
        setStatusMessage(`🎉 مبروك! فاز ${outcome === 'dragon' ? 'التنين 🐉' : outcome === 'tiger' ? 'النمر 🐯' : 'التعادل 🤝'} وربحت ${winCoins.toLocaleString()} كوينز!`);
        onWinAnnouncement?.(
          selectedGame?.nameAr || 'التنين والنمر',
          outcome === 'dragon' ? '🐉' : '🐯',
          winCoins,
          mult
        );
      } else {
        setStatusMessage(
          `النتيجة: التنين (${cardLabels[dVal - 1]}) ضد النمر (${cardLabels[tVal - 1]}). جرب الجولة القادمة!`
        );
      }
    }, 600);
  };

  // =========================================================================
  // ENGINE 5: OCEAN SHARK & TREASURE HUNT (صيد القروش والكنوز)
  // =========================================================================
  const [oceanCells, setOceanCells] = useState<
    { revealed: boolean; icon: string; mult: number; name: string }[]
  >(() =>
    Array.from({ length: 9 }, () => ({
      revealed: false,
      icon: '🐚',
      mult: 0,
      name: '',
    }))
  );

  const fireOceanTorpedo = (cellIdx: number) => {
    if (oceanCells[cellIdx]?.revealed) return;
    if (currentUser.coins < betAmount) {
      setStatusMessage('رصيد الكوينز غير كافٍ لإطلاق الطوربيد!');
      return;
    }
    rechargeCoins(-betAmount, 'طلقة صيد القروش');

    const catches = [
      { icon: '🦈', name: 'القرش الذهبي', mult: 15 },
      { icon: '🐳', name: 'الحوت الملكي', mult: 8 },
      { icon: '🧜‍♀️', name: 'حورية البحر', mult: 5 },
      { icon: '🦪', name: 'لؤلؤة المحيط', mult: 3 },
      { icon: '🐠', name: 'سمكة المرجان', mult: 2 },
      { icon: '💣', name: 'لغم بحري', mult: 0 },
      { icon: '💣', name: 'لغم بحري', mult: 0 },
    ];
    const picked = catches[Math.floor(Math.random() * catches.length)];

    setOceanCells((prev) =>
      prev.map((c, i) =>
        i === cellIdx ? { revealed: true, icon: picked.icon, mult: picked.mult, name: picked.name } : c
      )
    );

    if (picked.mult > 0) {
      const winCoins = betAmount * picked.mult;
      rechargeCoins(winCoins, `صيد ${picked.name}`);
      if (picked.mult >= 8) {
        confetti({ particleCount: 55, spread: 70, origin: { y: 0.6 } });
      }
      setStatusMessage(`🎯 اصطدت ${picked.icon} ${picked.name}! ربحت ${winCoins.toLocaleString()} كوينز (${picked.mult}X)!`);
      if (picked.mult >= 5) {
        onWinAnnouncement?.(
          selectedGame?.nameAr || 'صيد القروش',
          picked.icon,
          winCoins,
          picked.mult
        );
      }
    } else {
      setStatusMessage('💥 انفجر لغم بحري فارغ! جرب صدفة أخرى');
    }
  };

  const resetOceanGrid = () => {
    setOceanCells(
      Array.from({ length: 9 }, () => ({
        revealed: false,
        icon: '🐚',
        mult: 0,
        name: '',
      }))
    );
    setStatusMessage('تم تجديد المحيط! اختر صدفة لإطلاق الطوربيد 🎯');
  };

  // =========================================================================
  // ENGINE 6: ZEUS 3x3 LIGHTNING SLOTS (برق زيوس والفراعنة)
  // =========================================================================
  const zeusSymbols = ['⚡', '👑', '💎', '🏺', '7️⃣', '🦁'];
  const [zeusGrid, setZeusGrid] = useState<string[]>([
    '⚡', '👑', '💎',
    '🏺', '⚡', '7️⃣',
    '💎', '👑', '⚡',
  ]);
  const [isZeusSpinning, setIsZeusSpinning] = useState<boolean>(false);

  const spinZeusSlots = () => {
    if (isZeusSpinning) return;
    if (currentUser.coins < betAmount) {
      setStatusMessage('رصيد الكوينز غير كافٍ!');
      return;
    }
    rechargeCoins(-betAmount, `رهان ${selectedGame?.nameAr || 'برق زيوس'}`);
    setIsZeusSpinning(true);
    setStatusMessage('زيوس يطلق الصواعق الذهبية... ⚡');

    let ticks = 0;
    const timer = window.setInterval(() => {
      setZeusGrid(
        Array.from({ length: 9 }, () => zeusSymbols[Math.floor(Math.random() * zeusSymbols.length)])
      );
      ticks++;
      if (ticks >= 10) {
        window.clearInterval(timer);
        setIsZeusSpinning(false);
        const isWin = Math.random() < 0.65;
        if (isWin) {
          const sym = zeusSymbols[Math.floor(Math.random() * zeusSymbols.length)];
          const mult = sym === '⚡' ? 12 : sym === '👑' ? 8 : 3;
          const newGrid = Array.from({ length: 9 }, (_, idx) =>
            idx < 3 || idx === 4 || idx === 8 ? sym : zeusSymbols[Math.floor(Math.random() * zeusSymbols.length)]
          );
          setZeusGrid(newGrid);
          const winCoins = betAmount * mult;
          rechargeCoins(winCoins, `فوز ${selectedGame?.nameAr || 'زيوس'}`);
          confetti({ particleCount: 55, spread: 70, origin: { y: 0.6 } });
          setStatusMessage(`⚡ صاعقة زيوس المضاعفة! ربحت ${winCoins.toLocaleString()} كوينز (${mult}X)!`);
          onWinAnnouncement?.(
            selectedGame?.nameAr || 'برق زيوس',
            sym,
            winCoins,
            mult
          );
        } else {
          setStatusMessage('حظ أوفر في الضربة القادمة!');
        }
      }
    }, 80);
  };

  // =========================================================================
  // RENDER GAME LOBBY OR ACTIVE GAME ENGINE
  // =========================================================================
  if (!selectedGame) {
    return (
      <div className="space-y-3">
        {/* Featured 6 Distinct Game Categories Strip */}
        <div className="grid grid-cols-3 gap-2">
          {FULL_GAMES_CATALOG.slice(0, 6).map((feat) => (
            <button
              key={feat.id}
              onClick={() => {
                setSelectedGame(feat);
                setStatusMessage(null);
              }}
              className={`relative rounded-2xl p-2.5 bg-gradient-to-br ${feat.bg} border-2 border-amber-400/80 text-white flex flex-col items-center justify-between shadow-lg active:scale-95 transition-transform overflow-hidden`}
            >
              {feat.badge && (
                <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-[8px] font-black text-white shadow">
                  {feat.badge}
                </span>
              )}
              <span className="text-3xl my-1 drop-shadow">{feat.icon}</span>
              <span className="text-[11px] font-black text-amber-200 truncate w-full text-center">
                {feat.nameAr}
              </span>
              <span className="text-[9px] text-white/80 font-bold">العب الآن ▶</span>
            </button>
          ))}
        </div>

        {/* All 30 Games 5-Column Grid */}
        <div
          className={`${
            compact ? 'max-h-[250px]' : 'max-h-[380px]'
          } overflow-y-auto pt-1 pr-1 grid grid-cols-5 gap-2`}
        >
          {FULL_GAMES_CATALOG.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setSelectedGame(g);
                setStatusMessage(null);
              }}
              className="flex flex-col items-center group active:scale-90 transition-transform"
            >
              <div
                className={`w-13 h-13 rounded-2xl bg-gradient-to-b ${g.bg} border-2 border-amber-400/80 shadow-md flex items-center justify-center text-2xl group-hover:border-yellow-200 transition-colors`}
              >
                {g.icon}
              </div>
              <span className="text-[9px] font-bold text-amber-100 truncate w-13 text-center mt-1">
                {g.nameAr}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-white">
      {/* Top Game Bar: Back to All Games | Game Name | Coins Balance */}
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
        <button
          onClick={() => {
            setSelectedGame(null);
            setStatusMessage(null);
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 text-xs font-bold text-amber-300 hover:bg-white/15"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>كل الألعاب</span>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-xl">{selectedGame.icon}</span>
          <span className="text-sm font-black text-amber-200">{selectedGame.nameAr}</span>
        </div>

        <button
          onClick={() => {
            if (onOpenWallet) onOpenWallet();
            else setActiveModal('wallet');
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-xs font-mono font-black text-yellow-300"
        >
          <span>{currentUser.coins.toLocaleString()}</span>
          <span>🪙 +</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* 1. CRASH ROCKET UI (لعبة صاروخ الانفجار)                             */}
      {/* =================================================================== */}
      {selectedGame.engine === 'crash_rocket' && (
        <div className="space-y-3">
          <div className="relative h-40 rounded-2xl bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 border-2 border-indigo-400/60 overflow-hidden flex flex-col items-center justify-center p-4">
            {/* Stars background */}
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* Multiplier Display */}
            <div
              className={`relative z-10 text-4xl font-mono font-black drop-shadow-lg ${
                rocketState === 'crashed'
                  ? 'text-rose-500'
                  : rocketState === 'cashed_out'
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {rocketMultiplier.toFixed(2)}X
            </div>

            {/* Animated Rocket Icon */}
            <div
              className={`relative z-10 text-5xl mt-2 transition-transform duration-150 ${
                rocketState === 'flying'
                  ? 'animate-bounce -rotate-12 scale-110'
                  : rocketState === 'crashed'
                  ? 'scale-125'
                  : ''
              }`}
            >
              {rocketState === 'crashed' ? '💥' : selectedGame.icon}
            </div>

            <span className="relative z-10 text-[11px] font-bold text-indigo-200 mt-1">
              {rocketState === 'flying'
                ? 'اسحب أرباحك قبل أن ينفجر الصاروخ!'
                : rocketState === 'crashed'
                ? 'تحطم الصاروخ!'
                : rocketState === 'cashed_out'
                ? 'تم تأمين الأرباح بنجاح ✅'
                : 'حدد الرهان واضغط إطلاق الصاروخ'}
            </span>
          </div>

          { rocketState === 'flying' ? (
            <button
              onClick={cashOutRocket}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-500 to-green-600 text-slate-950 font-black text-sm shadow-[0_0_25px_rgba(16,185,129,0.7)] animate-pulse"
            >
              💰 سحب الأرباح الآن ({Math.round(betAmount * rocketMultiplier).toLocaleString()} 🪙)
            </button>
          ) : (
            <button
              onClick={startCrashRocket}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-black text-sm shadow-lg active:scale-95 transition-transform"
            >
              🚀 إطلاق الصاروخ الآن ({betAmount.toLocaleString()} 🪙)
            </button>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. GREEDY LION 8-BOX TURNTABLE UI (الأسد الجشع وعجلة الحيوانات)     */}
      {/* =================================================================== */}
      {selectedGame.engine === 'greedy_lion' && (
        <div className="space-y-3">
          <div className="text-[11px] text-amber-200 text-center font-bold">
            اضغط على الحيوانات أو الفواكه لتحديد رهانك (يمكنك اختيار أكثر من مربع):
          </div>

          <div className="grid grid-cols-4 gap-2">
            {greedyItems.map((item, idx) => {
              const isSelected = selectedGreedyBets.includes(item.id);
              const isHighlighted = activeTurntableIdx === idx;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isTurntableSpinning) return;
                    setSelectedGreedyBets((prev) =>
                      prev.includes(item.id)
                        ? prev.filter((i) => i !== item.id)
                        : [...prev, item.id]
                    );
                  }}
                  className={`relative rounded-2xl p-2 bg-gradient-to-b ${item.color} border-2 flex flex-col items-center justify-center transition-all ${
                    isHighlighted
                      ? 'ring-4 ring-yellow-300 border-white scale-105 shadow-[0_0_20px_rgba(253,224,71,0.9)]'
                      : isSelected
                      ? 'border-amber-300 opacity-100'
                      : 'border-white/15 opacity-55'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 font-black text-[8px]">
                      رهان
                    </span>
                  )}
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-[10px] font-black text-white mt-0.5">{item.name}</span>
                  <span className="text-[9px] font-mono font-black text-yellow-200">
                    {item.mult}X
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={spinGreedyLion}
            disabled={isTurntableSpinning}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 text-slate-950 font-black text-sm shadow-lg active:scale-95 transition-transform disabled:opacity-50"
          >
            {isTurntableSpinning
              ? 'جاري الدوران...'
              : `🎡 بدء الدوران (إجمالي الرهان: ${(betAmount * selectedGreedyBets.length).toLocaleString()} 🪙)`}
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. PENALTY SHOOTOUT UI (كأس ركلات الترجيح)                           */}
      {/* =================================================================== */}
      {selectedGame.engine === 'penalty_kick' && (
        <div className="space-y-3">
          {/* Football Goal Post */}
          <div className="relative rounded-2xl bg-gradient-to-b from-emerald-900 via-green-800 to-emerald-950 border-4 border-white/90 p-3 shadow-inner">
            <div className="text-center text-[10px] font-black text-emerald-200 mb-2">
              اختر الزاوية التي تريد تسديد الكرة إليها ⚽:
            </div>

            <div className="grid grid-cols-3 gap-2">
              {goalCorners.slice(0, 3).map((corner) => (
                <button
                  key={corner.id}
                  onClick={() => shootPenalty(corner.id, corner.mult)}
                  disabled={isShootingBall}
                  className={`h-14 rounded-xl border border-white/30 bg-black/30 hover:bg-emerald-500/30 flex flex-col items-center justify-center transition-all ${
                    ballCorner === corner.id ? 'ring-2 ring-amber-400 bg-amber-500/30' : ''
                  }`}
                >
                  <span className="text-lg">
                    {keeperCorner === corner.id
                      ? '🧤'
                      : ballCorner === corner.id
                      ? '⚽'
                      : '🎯'}
                  </span>
                  <span className="text-[9px] font-bold text-white">{corner.label}</span>
                  <span className="text-[9px] font-black text-amber-300">{corner.mult}X</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              {goalCorners.slice(3).map((corner) => (
                <button
                  key={corner.id}
                  onClick={() => shootPenalty(corner.id, corner.mult)}
                  disabled={isShootingBall}
                  className={`h-14 rounded-xl border border-white/30 bg-black/30 hover:bg-emerald-500/30 flex flex-col items-center justify-center transition-all ${
                    ballCorner === corner.id ? 'ring-2 ring-amber-400 bg-amber-500/30' : ''
                  }`}
                >
                  <span className="text-lg">
                    {keeperCorner === corner.id
                      ? '🧤'
                      : ballCorner === corner.id
                      ? '⚽'
                      : '🎯'}
                  </span>
                  <span className="text-[9px] font-bold text-white">{corner.label}</span>
                  <span className="text-[9px] font-black text-amber-300">{corner.mult}X</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. DRAGON VS TIGER CARD BATTLE UI (معركة التنين والنمر)              */}
      {/* =================================================================== */}
      {selectedGame.engine === 'dragon_tiger' && (
        <div className="space-y-3">
          {/* Two 3D Cards Arena */}
          <div className="grid grid-cols-2 gap-4 bg-black/50 p-3 rounded-2xl border border-amber-500/30">
            <div className="flex flex-col items-center">
              <span className="text-xs font-black text-red-400 mb-1">🐉 التنين DRAGON</span>
              <div className="w-20 h-26 rounded-xl bg-gradient-to-b from-red-700 to-rose-950 border-2 border-amber-300 flex flex-col items-center justify-center shadow-lg">
                <span className="text-3xl font-black text-white">
                  {isDealingCards ? '🃏' : dragonCard ? dragonCard.label : '🐉'}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-xs font-black text-amber-400 mb-1">🐯 النمر TIGER</span>
              <div className="w-20 h-26 rounded-xl bg-gradient-to-b from-amber-600 to-yellow-950 border-2 border-amber-300 flex flex-col items-center justify-center shadow-lg">
                <span className="text-3xl font-black text-white">
                  {isDealingCards ? '🃏' : tigerCard ? tigerCard.label : '🐯'}
                </span>
              </div>
            </div>
          </div>

          {/* 3 Betting Choices */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'dragon', label: '🐉 التنين (2X)', color: 'from-red-600 to-rose-800' },
              { id: 'tie', label: '🤝 تعادل (11X)', color: 'from-emerald-600 to-teal-800' },
              { id: 'tiger', label: '🐯 النمر (2X)', color: 'from-amber-500 to-orange-700' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setDtChoice(opt.id as 'dragon' | 'tie' | 'tiger')}
                className={`py-2 px-2 rounded-xl bg-gradient-to-b ${opt.color} border-2 text-xs font-black transition-all ${
                  dtChoice === opt.id ? 'border-white scale-105 shadow-md' : 'border-transparent opacity-60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={dealDragonTiger}
            disabled={isDealingCards}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 text-slate-950 font-black text-sm shadow-lg"
          >
            {isDealingCards ? 'جاري كشف الأوراق...' : `🃏 اسحب الأوراق الآن (${betAmount.toLocaleString()} 🪙)`}
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. OCEAN SHARK & TREASURE HUNT UI (صيد القروش والكنوز)               */}
      {/* =================================================================== */}
      {selectedGame.engine === 'ocean_hunt' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-cyan-200 font-bold">
            <span>اضغط على أي صدفة لإطلاق الطوربيد وصيد القروش الذهبية:</span>
            <button
              onClick={resetOceanGrid}
              className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-black"
            >
              تجديد المحيط 🔄
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-gradient-to-b from-cyan-950 via-blue-950 to-slate-950 p-3 rounded-2xl border-2 border-cyan-400/50">
            {oceanCells.map((cell, i) => (
              <button
                key={i}
                onClick={() => fireOceanTorpedo(i)}
                className={`h-16 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  cell.revealed
                    ? cell.mult > 0
                      ? 'bg-amber-500/25 border-amber-300'
                      : 'bg-rose-950/50 border-rose-500/40'
                    : 'bg-cyan-500/15 border-cyan-400/40 hover:bg-cyan-400/25 active:scale-90'
                }`}
              >
                <span className="text-2xl">{cell.icon}</span>
                {cell.revealed ? (
                  <span className="text-[9px] font-black text-amber-300">
                    {cell.mult > 0 ? `${cell.name} (${cell.mult}X)` : 'لغم فارغ'}
                  </span>
                ) : (
                  <span className="text-[9px] text-cyan-200 font-bold">اضرب 🎯</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. ZEUS 3x3 SLOTS UI (برق زيوس والفراعنة)                            */}
      {/* =================================================================== */}
      {selectedGame.engine === 'zeus_slots' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 p-3 rounded-2xl border-2 border-amber-400">
            {zeusGrid.map((sym, i) => (
              <div
                key={i}
                className={`h-15 rounded-xl bg-black/50 border border-amber-400/40 flex items-center justify-center text-3xl shadow-inner ${
                  isZeusSpinning ? 'animate-pulse scale-95' : ''
                }`}
              >
                {sym}
              </div>
            ))}
          </div>

          <button
            onClick={spinZeusSlots}
            disabled={isZeusSpinning}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-sky-400 via-amber-400 to-yellow-500 text-slate-950 font-black text-sm shadow-lg"
          >
            {isZeusSpinning ? 'صاعقة زيوس تضرب...' : `⚡ ضربة برق زيوس (${betAmount.toLocaleString()} 🪙)`}
          </button>
        </div>
      )}

      {/* Status Result Banner */}
      {statusMessage && (
        <div className="text-center text-xs font-black text-amber-200 bg-amber-500/15 border border-amber-400/40 rounded-xl py-2 px-3">
          {statusMessage}
        </div>
      )}

      {/* Universal Bet Amount Selector Row */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
        <span className="text-[11px] font-bold text-stone-300">قيمة الرهان:</span>
        <div className="flex items-center gap-1.5">
          {[100, 500, 1000, 5000, 10000].map((bet) => (
            <button
              key={bet}
              onClick={() => setBetAmount(bet)}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black border transition-all ${
                betAmount === bet
                  ? 'bg-amber-400 text-slate-950 border-white shadow'
                  : 'bg-white/5 text-amber-200 border-white/10'
              }`}
            >
              {bet >= 1000 ? `${bet / 1000}K` : bet}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
