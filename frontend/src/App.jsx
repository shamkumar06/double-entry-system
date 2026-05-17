import React, { useState, useEffect } from 'react';
import { Download, Home, ChevronLeft, FolderOpen, Edit3, Settings as SettingsIcon, CheckCircle, Plus, Lock, LogOut, Activity, Book, Scale, FileText, Image, Layers, User, Menu, X } from 'lucide-react';
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
import { accountingApi, authApi, getImageUrl } from './services/api';
import { useSettings } from './context/SettingsContext';
import { ProjectDataProvider, useProjectData } from './context/ProjectDataContext';

function AppInner() {
  const { project: contextProject, loadProject, invalidate } = useProjectData();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeProject, setActiveProject] = useState(() => {
    try {
      const saved = sessionStorage.getItem('activeProject');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }); // {id, name, ...}
  const [activePhase, setActivePhase] = useState(() => {
    try {
      const saved = sessionStorage.getItem('activePhase');
      if (saved === 'null') return null;
      if (saved === 'undefined' || !saved) return undefined;
      return JSON.parse(saved);
    } catch {
      return undefined;
    }
  }); // undefined = phase screen, null = all, string = specific
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('activeTab') || 'Overview';
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sync state changes to sessionStorage automatically
  useEffect(() => {
    if (activeProject) {
      sessionStorage.setItem('activeProject', JSON.stringify(activeProject));
    } else {
      sessionStorage.removeItem('activeProject');
    }
  }, [activeProject]);

  useEffect(() => {
    if (activePhase === undefined) {
      sessionStorage.removeItem('activePhase');
    } else if (activePhase === null) {
      sessionStorage.setItem('activePhase', 'null');
    } else {
      sessionStorage.setItem('activePhase', JSON.stringify(activePhase));
    }
  }, [activePhase]);

  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Auto-close modals when switching navigation tabs
  useEffect(() => {
    setShowTransactionForm(false);
    setEditingTransaction(null);
    setShowEditModal(false);
  }, [activeTab]);



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
      setActivePhase(undefined);
      setActiveTab('Overview');
      sessionStorage.clear();
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
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
    padding: '0.7rem 1rem',
    borderRadius: '10px',
    background: activeTab === tab ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
    fontWeight: activeTab === tab ? 700 : 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s ease',
    fontSize: '0.9rem',
    textAlign: 'left'
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
      {/* Mobile Top Bar */}
      <div className="mobile-header mobile-only">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => setIsSidebarOpen(true)} className="btn-circle-glass" style={{ border: 'none', background: 'none' }}>
            <Menu size={24} />
          </button>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{activeProject.name}</span>
        </div>
        <button onClick={() => setActivePhase(undefined)} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '20px' }}>
          {activePhase?.name || 'All Phases'}
        </button>
      </div>

      <nav className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`} style={{ borderBottomLeftRadius: 0, borderTopLeftRadius: 0, borderBottomRightRadius: 0 }}>
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'none' }} className="mobile-close-btn">
           <button onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        <div className="sidebar-nav-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {activeProject.logoUrl ? (
                    <img src={getImageUrl(activeProject.logoUrl)} alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }} />
                ) : (
                    <FolderOpen color="var(--primary)" size={24} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>{activeProject.name}</h2>
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


          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '1.25rem' }}>
            <button style={navActive('Overview')} onClick={() => { setActiveTab('Overview'); setActivePhase(null); setIsSidebarOpen(false); }}><Activity size={18} /> Overview</button>
            <button style={navActive('Journal')} onClick={() => { setActiveTab('Journal'); setIsSidebarOpen(false); }}><Book size={18} /> Journal</button>
            <button style={navActive('Ledger')} onClick={() => { setActiveTab('Ledger'); setIsSidebarOpen(false); }}><Layers size={18} /> Ledger</button>
            <button style={navActive('Trial Balance')} onClick={() => { setActiveTab('Trial Balance'); setIsSidebarOpen(false); }}><Scale size={18} /> Trial Balance</button>
            <button style={navActive('Reports')} onClick={() => { setActiveTab('Reports'); setIsSidebarOpen(false); }}><FileText size={18} /> Reports</button>
            <button style={navActive('Receipts')} onClick={() => { setActiveTab('Receipts'); setIsSidebarOpen(false); }}><Image size={18} /> Receipts</button>
            
            <div style={{ height: '1px', background: 'var(--border)', margin: '1rem 0.5rem' }} />
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 1rem 0.4rem' }}>Management</p>
            
            <button style={navActive('Categories')} onClick={() => { setActiveTab('Categories'); setIsSidebarOpen(false); }}><SettingsIcon size={18} /> Categories</button>
            <button style={navActive('Settings')} onClick={() => { setActiveTab('Settings'); setIsSidebarOpen(false); }}><User size={18} /> Settings</button>
          </div>
        </div>
        
        {/* Sticky Profile Section - Edge-to-edge */}
        <div style={{ 
            background: 'var(--glass-bg)', 
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {activeTab === 'Overview' && (
              <button className="btn-circle-glass" onClick={() => setShowEditModal(true)} title="Edit Details">
                 <Edit3 size={20} />
              </button>
            )}

            {!isPhaseSettled && (activeTab === 'Journal' || activeTab === 'Overview') && (
              <button 
                className="desktop-only"
                onClick={() => { setEditingTransaction(null); setShowTransactionForm(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 132, 199, 0.35)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.25)';
                }}
              >
                <Plus size={18} /> Add Transaction
              </button>
            )}
          </div>
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

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav mobile-only">
        <button className={`mobile-nav-item ${activeTab === 'Overview' ? 'active' : ''}`} onClick={() => setActiveTab('Overview')}>
          <Home size={22} />
          <span>Home</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'Journal' ? 'active' : ''}`} onClick={() => setActiveTab('Journal')}>
          <Book size={22} />
          <span>Journal</span>
        </button>

        <button className={`mobile-nav-item ${activeTab === 'Ledger' ? 'active' : ''}`} onClick={() => setActiveTab('Ledger')}>
          <Layers size={22} />
          <span>Ledger</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'Reports' ? 'active' : ''}`} onClick={() => setActiveTab('Reports')}>
          <FileText size={22} />
          <span>Reports</span>
        </button>
      </div>

      {/* Floating Action Button (FAB) at bottom-right corner for Mobile */}
      {!isPhaseSettled && (
        <button 
          className="mobile-only"
          onClick={() => { setEditingTransaction(null); setShowTransactionForm(true); }}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            background: 'var(--primary)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
            border: 'none',
            zIndex: 999,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Plus size={28} />
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
