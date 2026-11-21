import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { HomeScreen } from './components/HomeScreen';
import { BottomNavBar } from './components/BottomNavBar';
import { GlobalJackpotBanner } from './components/GlobalJackpotBanner';
import { ErrorBoundary } from './components/ErrorBoundary';

const AuthScreen = lazy(() =>
  import('./components/AuthScreen').then((m) => ({ default: m.AuthScreen }))
);
const VoiceRoomView = lazy(() =>
  import('./components/VoiceRoomView').then((m) => ({ default: m.VoiceRoomView }))
);
const GameCenterScreen = lazy(() =>
  import('./components/GameCenterScreen').then((m) => ({ default: m.GameCenterScreen }))
);
const ChatInboxScreen = lazy(() =>
  import('./components/ChatInboxScreen').then((m) => ({ default: m.ChatInboxScreen }))
);
const ProfileScreen = lazy(() =>
  import('./components/ProfileScreen').then((m) => ({ default: m.ProfileScreen }))
);
const RechargeAgentPortal = lazy(() =>
  import('./components/RechargeAgentPortal').then((m) => ({ default: m.RechargeAgentPortal }))
);
const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const WalletModal = lazy(() =>
  import('./components/WalletModal').then((m) => ({ default: m.WalletModal }))
);
const VipCenterModal = lazy(() =>
  import('./components/VipCenterModal').then((m) => ({ default: m.VipCenterModal }))
);
const BackpackModal = lazy(() =>
  import('./components/BackpackModal').then((m) => ({ default: m.BackpackModal }))
);
const GameCenterModal = lazy(() =>
  import('./components/GameCenterModal').then((m) => ({ default: m.GameCenterModal }))
);
const AgencyPortalModal = lazy(() =>
  import('./components/AgencyPortalModal').then((m) => ({ default: m.AgencyPortalModal }))
);
const UserProfileModal = lazy(() =>
  import('./components/UserProfileModal').then((m) => ({ default: m.UserProfileModal }))
);
const MessagesDrawer = lazy(() =>
  import('./components/MessagesDrawer').then((m) => ({ default: m.MessagesDrawer }))
);
const CreateRoomModal = lazy(() =>
  import('./components/CreateRoomModal').then((m) => ({ default: m.CreateRoomModal }))
);

const ScreenLoader: React.FC = () => (
  <div className="min-h-[40vh] flex items-center justify-center text-xs font-bold text-amber-300">
    جاري التحميل...
  </div>
);

const MainLayout: React.FC = () => {
  const {
    activeRoom,
    currentView,
    activeTab,
    activeModal,
    setActiveModal,
    firebaseUser,
    authReady,
    needsProfileCompletion,
    guestAccessBypass,
  } = useApp();

  if (!authReady) {
    return (
      <div className="min-h-dvh bg-[#070a12] text-slate-200 font-tajawal flex flex-col items-center justify-center gap-3 p-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg">
          🎙️
        </div>
        <div className="text-sm font-bold text-amber-300">جاري تجهيز غرف الدردشة الصوتية...</div>
      </div>
    );
  }

  if ((!firebaseUser && !guestAccessBypass) || needsProfileCompletion) {
    return (
      <Suspense fallback={<ScreenLoader />}>
        <AuthScreen />
      </Suspense>
    );
  }

  const renderUserAppTab = () => {
    switch (activeTab) {
      case 'room':
        return <HomeScreen />;
      case 'game':
        return <GameCenterScreen />;
      case 'chat':
        return <ChatInboxScreen />;
      case 'me':
        return <ProfileScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-tajawal selection:bg-amber-500 selection:text-slate-950">
      <GlobalJackpotBanner />

      {currentView !== 'user_app' && !activeRoom && <Navbar />}

      <main className="flex-1">
        <Suspense fallback={<ScreenLoader />}>
          {activeRoom ? (
            <VoiceRoomView />
          ) : currentView === 'user_app' ? (
            <div className="relative">
              {renderUserAppTab()}
              <BottomNavBar />
            </div>
          ) : currentView === 'agent_portal' ? (
            <RechargeAgentPortal />
          ) : (
            <AdminDashboard />
          )}
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {activeModal === 'wallet' && (
          <WalletModal isOpen onClose={() => setActiveModal('none')} />
        )}
        {activeModal === 'vip' && (
          <VipCenterModal isOpen onClose={() => setActiveModal('none')} />
        )}
        {(activeModal === 'backpack' || activeModal === 'store') && (
          <BackpackModal isOpen onClose={() => setActiveModal('none')} />
        )}
        {activeModal === 'games' && (
          <GameCenterModal isOpen onClose={() => setActiveModal('none')} />
        )}
        {activeModal === 'agency' && (
          <AgencyPortalModal isOpen onClose={() => setActiveModal('none')} />
        )}
        {activeModal === 'profile' && (
          <UserProfileModal isOpen onClose={() => setActiveModal('none')} />
        )}
        {activeModal === 'messages' && (
          <MessagesDrawer isOpen onClose={() => setActiveModal('none')} />
        )}
        {activeModal === 'create_room' && (
          <CreateRoomModal isOpen onClose={() => setActiveModal('none')} />
        )}
      </Suspense>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ErrorBoundary>
  );
}
