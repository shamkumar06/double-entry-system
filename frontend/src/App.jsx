import React, { useState, useEffect } from 'react';
import { Download, Home, ChevronLeft, FolderOpen, Edit3, Settings as SettingsIcon, CheckCircle, Plus, Lock, LogOut } from 'lucide-react';
import Journal from './components/Journal';
import Ledger from './components/Ledger';
import TrialBalance from './components/TrialBalance';
import TransactionForm from './components/TransactionForm';
import CategoryManager from './components/CategoryManager';
import HomeScreen from './components/HomeScreen';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import PhaseSelector from './components/PhaseSelector';
import EditOverviewModal from './components/EditOverviewModal';
import Reports from './components/Reports';
import LoginScreen from './components/LoginScreen';
import ReceiptsGallery from './components/ReceiptsGallery';
import { accountingApi, authApi } from './services/api';
import { useSettings } from './context/SettingsContext';
import { ProjectDataProvider, useProjectData } from './context/ProjectDataContext';

function AppInner() {
  const { project: contextProject, loadProject, invalidate } = useProjectData();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeProject, setActiveProject] = useState(null); // {id, name, ...}
  const [activePhase, setActivePhase] = useState(undefined); // undefined = phase screen, null = all, string = specific
  const [activeTab, setActiveTab] = useState('Overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const phasesList = Array.isArray(contextProject?.phases) ? contextProject.phases : Object.values(contextProject?.phases || activeProject?.phases || {});

  // When project/phase changes, load data into shared context
  useEffect(() => {
    if (activeProject?.id) {
      loadProject(activeProject.id, activePhase?.id || null);
    }
  }, [activeProject?.id, activePhase?.id]);
  const [selectedPhases, setSelectedPhases] = useState([]);
  const [activeAccount, setActiveAccount] = useState('Cash');
  const { settings } = useSettings();

  const fetchUser = async () => {
    try {
      const u = await authApi.getMe();
      setIsAuthenticated(true);
      setUser(u);
    } catch (err) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.altKey) {
        switch(e.key.toLowerCase()) {
          case 'o': e.preventDefault(); setActiveTab('Overview'); break;
          case 'j': e.preventDefault(); setActiveTab('Journal'); break;
          case 'l': e.preventDefault(); setActiveTab('Ledger'); break;
          case 't': e.preventDefault(); setActiveTab('Trial Balance'); break;
          case 'r': e.preventDefault(); setActiveTab('Reports'); break;
          case 'n': 
            e.preventDefault(); 
            const settled = activePhase?.name && activeProject?.phases ? Object.values(activeProject.phases).find(p => p.id === activePhase.id)?.isSettled : false;
            if (activeTab === 'Journal' && !settled) {
                setEditingTransaction(null);
                setShowTransactionForm(true);
            }
            break;
          default: break;
        }
      }
      if (e.key === 'Escape') {
        setShowEditModal(false);
        setShowTransactionForm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, activePhase, activeProject]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      setIsAuthenticated(false);
      setActiveProject(null);
    } catch(e) { console.error('Failed to logout', e); }
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      await accountingApi.generateReport(
        activeProject?.id,
        activeProject?.name,
        activeTab,
        activePhase?.id || null,
        {
          date_format: settings.dateFormat,
          sort_order: settings.sortOrder,
          sections: settings.reportSections
        }
      );
    } catch {
      alert("Failed to generate report. Is the backend running?");
    } finally {
      setDownloading(false);
    }
  };

  const handleCategoryRename = (oldName, newName) => {
    if (activeAccount === oldName) {
      setActiveAccount(newName);
    }
    setRefreshKey(k => k + 1);
  };

  const refreshProjectData = async () => {
    try {
      const projs = await accountingApi.listProjects();
      const updated = projs.find(p => p.id === activeProject.id);
      if (updated) {
        setActiveProject(updated);
      }
      // Reload shared context data
      if (activeProject?.id) invalidate(activeProject.id, activePhase?.id || null);
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error("Failed to sync project data:", e);
    }
  };

  const navActive = (tab) => ({
    textAlign: 'left',
    color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    background: activeTab === tab ? 'var(--surface-hover)' : 'transparent',
    fontWeight: activeTab === tab ? 700 : 500,
    cursor: 'pointer',
    borderLeft: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
    transition: 'all 0.15s ease',
    fontSize: '0.85rem'
  });

  // Stage 0: Auth Check
  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', color: 'var(--text-muted)' }}>
        Authenticating session...
      </div>
    );
  }

  // Stage 1: Login
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={(u) => { 
      if (u) setUser(u);
      setIsAuthenticated(true); 
      if (!u) fetchUser(); // Fallback if no user object passed
    }} />;
  }

  // Stage 2: Home Screen (Project Selector)
  if (!activeProject) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'flex-end', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={handleLogout} style={{ color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>Sign Out</button>
        </div>
        <HomeScreen onSelectProject={(project) => { 
          setActiveProject(project); 
          setActivePhase(undefined); 
          setActiveTab('Overview'); 
        }} />
      </div>
    );
  }

  // Stage 3: Phase Selector
  if (activePhase === undefined) {
    return (
      <PhaseSelector
        project={activeProject}
        onSelectPhase={(phase) => { 
          // phase is now an object { name, phase_id } from PhaseSelector
          setActivePhase(phase); 
          setActiveTab('Overview'); 
        }}
        onBack={() => setActiveProject(null)}
      />
    );
  }

    // Find current phase data to check settlement status
    const isPhaseSettled = activePhase?.name && phasesList.length > 0
        ? phasesList.find(p => p.id === activePhase.id)?.isSettled 
        : false;

    // Project dashboard
    return (
    <div className="app-container">
      <nav className="sidebar glass-panel" style={{ borderBottomLeftRadius: 0, borderTopLeftRadius: 0, borderBottomRightRadius: 0 }}>
        <div className="sidebar-nav-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {activeProject.logoUrl ? (
                    <img src={activeProject.logoUrl} alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }} />
                ) : (
                    <FolderOpen color="var(--primary)" size={24} />
                )}
                <div style={{ overflow: 'hidden' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1.1, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{activeProject.name}</h2>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '1px' }}>{activeProject.description || 'Accounting'}</p>
                </div>
            </div>
          {/* Phase Switcher (Interactive Badge) */}
          <div 
            onClick={() => setActivePhase(undefined)}
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', 
              padding: '0.25rem 0.6rem', borderRadius: '8px', 
              background: isPhaseSettled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(2, 132, 199, 0.08)', 
              fontSize: '0.7rem', fontWeight: 700, 
              color: isPhaseSettled ? 'var(--success)' : 'var(--primary)',
              cursor: 'pointer',
              border: '1px solid transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = isPhaseSettled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)';
              e.currentTarget.style.borderColor = isPhaseSettled ? 'var(--success)' : 'var(--primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isPhaseSettled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(2, 132, 199, 0.08)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
            title="Click to Switch Phase"
          >
            🔖 {activePhase?.name || 'All Phases'}
            {isPhaseSettled ? <Lock size={10} /> : <div style={{ fontSize: '9px', opacity: 0.6 }}>▼</div>}
          </div>
          
          {/* Quick Add Button underneath phase badge */}
          {activeTab === 'Journal' && !isPhaseSettled && (
             <button onClick={() => { setEditingTransaction(null); setShowTransactionForm(true); }} style={{ marginTop: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', background: 'var(--primary)', color: 'white', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.9} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
               <Plus size={14} /> Add Transaction
             </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '1rem' }}>
            <button style={navActive('Overview')} onClick={() => { setActiveTab('Overview'); setActivePhase(null); }}>📊  Overview</button>
            <button style={navActive('Journal')} onClick={() => setActiveTab('Journal')}>📖  Journal</button>
            <button style={navActive('Ledger')} onClick={() => setActiveTab('Ledger')}>📒  Ledger</button>
            <button style={navActive('Trial Balance')} onClick={() => setActiveTab('Trial Balance')}>⚖️  Trial Balance</button>
            <button style={navActive('Reports')} onClick={() => setActiveTab('Reports')}>📄  Reports</button>
            <button style={navActive('Receipts')} onClick={() => setActiveTab('Receipts')}>🧾  Receipts</button>
            <div style={{ height: '1px', background: 'var(--border)', margin: '0.75rem 0' }} />
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.75rem 0.25rem' }}>Management</p>
            <button style={navActive('Categories')} onClick={() => setActiveTab('Categories')}>⚙️  Categories</button>
            <button style={navActive('Settings')} onClick={() => setActiveTab('Settings')}>👤  Settings</button>
          </div>
        </div>
        
        {/* Sticky Profile Section - Edge-to-edge */}
        <div style={{ 
            background: 'rgba(255, 255, 255, 0.4)', 
            borderTop: '1px solid var(--border)', 
            padding: '0.75rem 1.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.name || user?.email?.split('@')[0] || 'User'}</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>{user?.role || 'VIEWER'}</p>
          </div>
          <button onClick={handleLogout} title="Sign Out" style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.35rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      <main className="main-content" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
          <button onClick={() => setActiveProject(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', transition: 'color 0.2s', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <Home size={14} /> Projects
          </button>
          <span>/</span>
          <button onClick={() => setActivePhase(undefined)} style={{ color: 'var(--text-muted)', transition: 'color 0.2s', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            {activeProject?.name}
          </button>
          {activePhase && (
            <>
              <span>/</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{activePhase.name}</span>
            </>
          )}
        </div>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {activeTab === 'Overview' ? (activePhase ? 'Phase Summary' : 'Project Overview') : activeTab}
              {activeTab === 'Overview' && activePhase && isPhaseSettled && (
                <span style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', 
                    padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '1rem', fontWeight: 700
                }}>
                    <CheckCircle size={18} /> SETTLED
                </span>
              )}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
              {activeProject?.name} {activePhase?.name ? `› ${activePhase.name}` : '› All Phases'}
            </p>
          </div>
          {activeTab === 'Overview' && (
            <button className="btn-circle-glass" onClick={() => setShowEditModal(true)} title="Edit Details">
               <Edit3 size={20} />
            </button>
          )}
          {/* Header button removed as per user request (shortcuts available in sidebar/FAB) */}
        </header>

        {activeTab === 'Overview' && (
            <Dashboard 
                projectId={activeProject?.id} 
                projectName={activeProject?.name}
                phaseId={activePhase?.id}
                phaseName={activePhase?.name} 
                onSelectPhase={(ph) => {
                    setActivePhase(ph);
                }} 
                refreshKey={refreshKey}
            />
        )}
        {activeTab === 'Journal' && (
            <Journal 
                projectId={activeProject?.id}
                projectName={activeProject?.name} 
                phaseId={activePhase?.id}
                phaseName={activePhase?.name} 
                selectedPhases={selectedPhases} 
                setSelectedPhases={setSelectedPhases} 
                onEdit={(tx) => { setEditingTransaction(tx); setShowTransactionForm(true); }} 
                key={`journal-${refreshKey}`} 
            />
        )}
        {activeTab === 'Ledger' && (
            <Ledger 
                projectId={activeProject?.id}
                projectName={activeProject?.name} 
                phaseId={activePhase?.id}
                phaseName={activePhase?.name} 
                accountName={activeAccount} 
                setAccountName={setActiveAccount} 
                selectedPhases={selectedPhases} 
                setSelectedPhases={setSelectedPhases} 
                key={`ledger-${refreshKey}`} 
            />
        )}
        {activeTab === 'Trial Balance' && (
            <TrialBalance 
                projectId={activeProject?.id}
                projectName={activeProject?.name} 
                phaseId={activePhase?.id}
                selectedPhases={selectedPhases} 
                setSelectedPhases={setSelectedPhases} 
                key={`tb-${refreshKey}`} 
            />
        )}
        {activeTab === 'Reports' && (
            <Reports 
                projectId={activeProject?.id} 
                projectName={activeProject?.name} 
                phasesList={phasesList} 
                key={`reports-${refreshKey}`} 
            />
        )}
        {activeTab === 'Receipts' && (
            <ReceiptsGallery
                projectId={activeProject?.id}
                phaseId={activePhase?.id}
                key={`receipts-${refreshKey}`}
            />
        )}
        {activeTab === 'Categories' && <CategoryManager onRename={handleCategoryRename} userRole={user?.role} />}
        {activeTab === 'Settings' && <Settings activeProject={activeProject} onUpdate={refreshProjectData} user={user} />}

        {showTransactionForm && (
          <TransactionForm
            projectId={activeProject?.id}
            projectName={activeProject?.name}
            phaseId={activePhase?.id}
            phaseName={activePhase?.name}
            initialData={editingTransaction}
            onCancel={() => { setShowTransactionForm(false); setEditingTransaction(null); }}
            onComplete={() => { setShowTransactionForm(false); setEditingTransaction(null); setRefreshKey(k => k + 1); invalidate(activeProject?.id, activePhase?.id || null); }}
          />
        )}

        {showEditModal && (
          <EditOverviewModal
            project={activeProject}
            phaseObj={activePhase?.id ? phasesList.find(p => p.id === activePhase.id) : null}
            onClose={() => setShowEditModal(false)}
            onComplete={async (newName) => {
              setShowEditModal(false);
              setRefreshKey(k => k + 1);
              try {
                // Refresh project data to reflect changes
                const projs = await accountingApi.listProjects();
                const updated = projs.find(p => p.id === activeProject.id);
                if (updated) {
                  setActiveProject(updated);
                  if (activePhase && newName && newName !== activePhase.name) {
                    const newPh = Object.values(updated.phases || {}).find(p => p.name === newName);
                    if (newPh) setActivePhase(newPh);
                  }
                }
              } catch(e) { console.error(e); }
            }}
          />
        )}

        {/* Floating Action Button for Journal */}
        {activeTab === 'Journal' && !isPhaseSettled && (
          <button
            onClick={() => { setEditingTransaction(null); setShowTransactionForm(true); }}
            style={{
              position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100,
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--primary)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(79,70,229,0.3)', cursor: 'pointer',
              border: 'none', transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(79,70,229,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(79,70,229,0.3)'; }}
            title="New Transaction (Alt+N)"
          >
            <Plus size={24} />
          </button>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <ProjectDataProvider>
      <AppInner />
    </ProjectDataProvider>
  );
}

export default App;
