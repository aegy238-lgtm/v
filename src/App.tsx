import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { HomeScreen } from './components/HomeScreen';
import { VoiceRoomView } from './components/VoiceRoomView';
import { GameCenterScreen } from './components/GameCenterScreen';
import { ChatInboxScreen } from './components/ChatInboxScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { BottomNavBar } from './components/BottomNavBar';
import { RechargeAgentPortal } from './components/RechargeAgentPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { WalletModal } from './components/WalletModal';
import { VipCenterModal } from './components/VipCenterModal';
import { BackpackModal } from './components/BackpackModal';
import { GameCenterModal } from './components/GameCenterModal';
import { AgencyPortalModal } from './components/AgencyPortalModal';
import { UserProfileModal } from './components/UserProfileModal';
import { MessagesDrawer } from './components/MessagesDrawer';
import { CreateRoomModal } from './components/CreateRoomModal';

const MainLayout: React.FC = () => {
  const {
    activeRoom,
    currentView,
    activeTab,
    activeModal,
    setActiveModal,
  } = useApp();

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-tajawal selection:bg-amber-500 selection:text-slate-950">
      {/* Show top universal bar only when viewing Admin Dashboard or Recharge Agent Portal */}
      {currentView !== 'user_app' && !activeRoom && <Navbar />}

      {/* Main View Router */}
      <main className="flex-1">
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
      </main>

      {/* Universal Modals */}
      <WalletModal
        isOpen={activeModal === 'wallet'}
        onClose={() => setActiveModal('none')}
      />

      <VipCenterModal
        isOpen={activeModal === 'vip'}
        onClose={() => setActiveModal('none')}
      />

      <BackpackModal
        isOpen={activeModal === 'backpack' || activeModal === 'store'}
        onClose={() => setActiveModal('none')}
      />

      <GameCenterModal
        isOpen={activeModal === 'games'}
        onClose={() => setActiveModal('none')}
      />

      <AgencyPortalModal
        isOpen={activeModal === 'agency'}
        onClose={() => setActiveModal('none')}
      />

      <UserProfileModal
        isOpen={activeModal === 'profile'}
        onClose={() => setActiveModal('none')}
      />

      <MessagesDrawer
        isOpen={activeModal === 'messages'}
        onClose={() => setActiveModal('none')}
      />

      <CreateRoomModal
        isOpen={activeModal === 'create_room'}
        onClose={() => setActiveModal('none')}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
