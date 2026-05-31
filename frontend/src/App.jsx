import React, { useState, useEffect, useCallback } from 'react';
import { Download, Home, ChevronLeft, ChevronRight, FolderOpen, Edit3, Settings as SettingsIcon, CheckCircle, Plus, Lock, LogOut, Activity, Book, Scale, FileText, Image, Layers, User, Users, Menu, X, Package, PieChart as PieChartIcon } from 'lucide-react';
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
import Analytics from './components/Analytics';
import CashierTracker from './components/CashierTracker';
import LoginScreen from './components/LoginScreen';
import ReceiptsGallery from './components/ReceiptsGallery';
import ProcurementManager from './components/ProcurementManager';
import { accountingApi, authApi, getImageUrl } from './services/api';
import { useSettings, useCurrency } from './context/SettingsContext';
import { ProjectDataProvider, useProjectData } from './context/ProjectDataContext';

function AppInner() {
  const { project: contextProject, journal, phaseFinances, categories: contextCategories, loadProject, invalidate } = useProjectData();
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
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showReallocateModal, setShowReallocateModal] = useState(false);
  const [selectedSourcePhaseId, setSelectedSourcePhaseId] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);
  const [reallocateLoading, setReallocateLoading] = useState(false);
  const [settleError, setSettleError] = useState('');
  const [reallocateError, setReallocateError] = useState('');

  // Phase Quick Selector Dropdown
  const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
  const [showMobilePhaseDropdown, setShowMobilePhaseDropdown] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('#phase-selector-dropdown-trigger')) {
        setShowPhaseDropdown(false);
      }
      if (!e.target.closest('#mobile-phase-selector-trigger')) {
        setShowMobilePhaseDropdown(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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

  // Handle drag-to-connect transfers from the Financial Mind Map
  const handleGraphTransfer = useCallback((transferData) => {
    const { sourceName, sourceType, targetName, targetType, amount, description } = transferData;

    // Look up the target's ASSET account to pre-fill the Category dropdown
    const targetAccount = contextCategories?.find(c => c.name === targetName && c.type === 'ASSET');

    // Build a pre-filled transaction object for TransactionForm
    const prefilled = {
      projectId: activeProject?.id,
      project_id: activeProject?.id,
      project_name: activeProject?.name,
      amount: amount,
      description: description || `Transfer: ${sourceName} → ${targetName}`,
      fromEntity: sourceName,
      toEntity: targetName,
      paymentMode: 'Cash',
      date: new Date().toISOString(),
      // If source is ROOT (Main Cash Account), leave cashierName blank so it debits the global cash
      // Otherwise the source person is the "cashier" spending the money
      cashierName: (sourceType === 'root') ? '' : sourceName,
      // Pre-fill the category to the target's ASSET account
      category_id: targetAccount?.id || '',
    };

    setEditingTransaction(prefilled);
    setShowTransactionForm(true);
  }, [activeProject, contextCategories]);

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
  const { formatCurrency } = useCurrency();

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
          case 'a': e.preventDefault(); setActiveTab('Analytics'); break;
          case 'k': e.preventDefault(); setActiveTab('Cashier Tracker'); break;
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

  const handleSettlePhase = async () => {
    setSettleLoading(true);
    setSettleError('');
    try {
      await accountingApi.settlePhase(activeProject.id, activePhase.id);
      setShowSettleModal(false);
      // Invalidate context to reload everything cleanly!
      invalidate(activeProject.id, activePhase?.id || null);
      setRefreshKey(prev => prev + 1);
    } catch (e) {
      setSettleError(e.response?.data?.message || e.message || 'Failed to settle phase');
    } finally {
      setSettleLoading(false);
    }
  };

  const handleReallocateSurplus = async () => {
    if (!selectedSourcePhaseId) {
      setReallocateError('Please select a source phase.');
      return;
    }
    setReallocateLoading(true);
    setReallocateError('');
    try {
      await accountingApi.reallocateSurplus(activeProject.id, activePhase.id, selectedSourcePhaseId);
      setShowReallocateModal(false);
      setSelectedSourcePhaseId('');
      // Invalidate context to reload everything cleanly!
      invalidate(activeProject.id, activePhase?.id || null);
      setRefreshKey(prev => prev + 1);
    } catch (e) {
      setReallocateError(e.response?.data?.message || e.message || 'Failed to reallocate surplus');
    } finally {
      setReallocateLoading(false);
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
        user={user}
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

    const activePhaseDataForSettle = activePhase?.id && phaseFinances ? phaseFinances[activePhase.id] : null;
    const currentBalanceForSettle = activePhaseDataForSettle ? activePhaseDataForSettle.balance : 0;

    const reallocatedSourceNamesForModal = Array.isArray(journal) 
      ? journal
          .filter(tx => tx.description && tx.description.includes('SYSTEM AUTOMATED REALLOCATION'))
          .map(tx => tx.fromEntity)
      : [];

    const eligiblePhasesForReallocateModal = phasesList.filter(p => {
      return p.isSettled && 
             p.id !== activePhase?.id && 
             Number(p.returnedAmount || 0) > 0 &&
             !reallocatedSourceNamesForModal.includes(p.name);
    });

    // Project dashboard
    return (
    <div className="app-container">
      {/* Mobile Top Bar */}
      <div className="mobile-header mobile-only">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface-hover)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              color: 'var(--text-main)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Menu size={18} />
          </button>
          <span style={{ 
            fontWeight: 800, 
            fontSize: '0.88rem', 
            color: 'var(--text-main)',
            maxWidth: '140px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {activeProject.name}
          </span>
        </div>

        {/* Inline Mobile Phase Switcher Dropdown */}
        <div style={{ position: 'relative', display: 'inline-block' }} id="mobile-phase-selector-trigger">
          <div 
            onClick={() => setShowMobilePhaseDropdown(prev => !prev)}
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem', 
              padding: '0.35rem 0.65rem', borderRadius: '20px', 
              background: isPhaseSettled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(2, 132, 199, 0.08)', 
              fontSize: '0.72rem', fontWeight: 700, 
              color: isPhaseSettled ? 'var(--success)' : 'var(--primary)',
              cursor: 'pointer',
              border: '1px solid var(--border)',
            }}
          >
            🔖 {activePhase?.name || 'All Phases'}
            <div style={{ fontSize: '8px', opacity: 0.6 }}>▼</div>
          </div>

          {showMobilePhaseDropdown && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 9999,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '0.4rem',
              minWidth: '180px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              animation: 'fadeIn 0.15s ease-out'
            }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.3rem 0.5rem', letterSpacing: '0.05em' }}>
                Switch Phase
              </div>
              
              {/* Option 1: All Phases */}
              <button
                onClick={() => {
                  setActivePhase(null);
                  setShowMobilePhaseDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '8px',
                  background: activePhase === null ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                  border: 'none',
                  color: activePhase === null ? 'var(--primary)' : 'var(--text-main)',
                  fontSize: '0.72rem',
                  fontWeight: activePhase === null ? 700 : 500,
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <span>📁 All Phases</span>
                {activePhase === null && <CheckCircle size={10} color="var(--primary)" />}
              </button>

              {/* Option 2: Full Phase Screen */}
              <button
                onClick={() => {
                  setActivePhase(undefined);
                  setShowMobilePhaseDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <span>🎛️ Full Phase Screen</span>
              </button>

              <div style={{ height: '1px', background: 'var(--border)', margin: '0.2rem 0' }} />

              {/* Options list */}
              {phasesList.map(p => {
                const isCurrent = activePhase?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePhase({ id: p.id, name: p.name });
                      setShowMobilePhaseDropdown(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.45rem 0.6rem',
                      borderRadius: '8px',
                      background: isCurrent ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                      border: 'none',
                      color: isCurrent ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '0.72rem',
                      fontWeight: isCurrent ? 700 : 500,
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                      {p.isSettled ? '🔒 ' : '📂 '} {p.name}
                    </span>
                    {isCurrent && <CheckCircle size={10} color="var(--primary)" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <nav className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`} style={{ borderBottomLeftRadius: 0, borderTopLeftRadius: 0, borderBottomRightRadius: 0, position: 'relative' }}>
        {/* Desktop Sidebar Toggle (Floating on the right boundary edge) */}
        <button 
          onClick={() => setIsSidebarCollapsed(prev => !prev)}
          className="sidebar-toggle-btn desktop-only"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          style={{
            position: 'absolute',
            right: '-11px',
            top: '20px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {isSidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'none' }} className="mobile-close-btn">
           <button onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        <div className="sidebar-nav-content">
            <div className="brand-header" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', position: 'relative' }}>
                {activeProject.logoUrl ? (
                    <img src={getImageUrl(activeProject.logoUrl)} alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }} />
                ) : (
                    <FolderOpen color="var(--primary)" size={24} />
                )}
                <div className="nav-label" style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>{activeProject.name}</h2>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '1px' }}>{activeProject.description || 'Accounting'}</p>
                </div>
            </div>
          {/* Phase Switcher (Interactive Dropdown Badge) */}
          <div style={{ position: 'relative', display: 'inline-block' }} id="phase-selector-dropdown-trigger">
            <div 
              onClick={() => setShowPhaseDropdown(prev => !prev)}
              className="phase-badge"
              style={{ 
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem', 
                padding: '0.25rem 0.65rem', borderRadius: '8px', 
                background: isPhaseSettled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(2, 132, 199, 0.08)', 
                fontSize: '0.72rem', fontWeight: 700, 
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
              title="Click to Switch Phase inline"
            >
              🔖 <span className="nav-label">{activePhase?.name || 'All Phases'}</span>
              {isPhaseSettled ? <Lock size={10} /> : <div className="nav-label" style={{ fontSize: '9px', opacity: 0.6 }}>▼</div>}
            </div>

            {showPhaseDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 9999,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '0.4rem',
                minWidth: '200px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                animation: 'fadeIn 0.15s ease-out'
              }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.3rem 0.5rem', letterSpacing: '0.05em' }}>
                  Switch Phase
                </div>
                
                {/* Option 1: All Phases */}
                <button
                  onClick={() => {
                    setActivePhase(null);
                    setShowPhaseDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    background: activePhase === null ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                    border: 'none',
                    color: activePhase === null ? 'var(--primary)' : 'var(--text-main)',
                    fontSize: '0.75rem',
                    fontWeight: activePhase === null ? 700 : 500,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = activePhase === null ? 'rgba(2, 132, 199, 0.08)' : 'transparent'}
                >
                  <span>📁 All Phases</span>
                  {activePhase === null && <CheckCircle size={12} color="var(--primary)" />}
                </button>

                {/* Option 2: Full Phase Selection Screen */}
                <button
                  onClick={() => {
                    setActivePhase(undefined);
                    setShowPhaseDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.color = 'var(--text-main)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <span>🎛️ Full Phase Screen</span>
                </button>

                <div style={{ height: '1px', background: 'var(--border)', margin: '0.2rem 0' }} />

                {/* Option List: Individual Phases */}
                {phasesList.map(p => {
                  const isCurrent = activePhase?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePhase({ id: p.id, name: p.name });
                        setShowPhaseDropdown(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.6rem',
                        borderRadius: '8px',
                        background: isCurrent ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                        border: 'none',
                        color: isCurrent ? 'var(--primary)' : 'var(--text-main)',
                        fontSize: '0.75rem',
                        fontWeight: isCurrent ? 700 : 500,
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'left',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = isCurrent ? 'rgba(2, 132, 199, 0.08)' : 'transparent'}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        {p.isSettled ? '🔒 ' : '📂 '} {p.name}
                      </span>
                      {isCurrent && <CheckCircle size={12} color="var(--primary)" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>


          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '1.25rem' }}>
            <button className="sidebar-nav-btn" style={navActive('Overview')} onClick={() => { setActiveTab('Overview'); setActivePhase(null); setIsSidebarOpen(false); }}><Activity size={18} /> <span className="nav-label">Overview</span></button>
            <button className="sidebar-nav-btn" style={navActive('Journal')} onClick={() => { setActiveTab('Journal'); setIsSidebarOpen(false); }}><Book size={18} /> <span className="nav-label">Journal</span></button>
            <button className="sidebar-nav-btn" style={navActive('Ledger')} onClick={() => { setActiveTab('Ledger'); setIsSidebarOpen(false); }}><Layers size={18} /> <span className="nav-label">Ledger</span></button>
            <button className="sidebar-nav-btn" style={navActive('Trial Balance')} onClick={() => { setActiveTab('Trial Balance'); setIsSidebarOpen(false); }}><Scale size={18} /> <span className="nav-label">Trial Balance</span></button>
            <button className="sidebar-nav-btn" style={navActive('Reports')} onClick={() => { setActiveTab('Reports'); setIsSidebarOpen(false); }}><FileText size={18} /> <span className="nav-label">Reports</span></button>
            <button className="sidebar-nav-btn" style={navActive('Analytics')} onClick={() => { setActiveTab('Analytics'); setIsSidebarOpen(false); }}><PieChartIcon size={18} /> <span className="nav-label">Analytics</span></button>
            <button className="sidebar-nav-btn" style={navActive('Cashier Tracker')} onClick={() => { setActiveTab('Cashier Tracker'); setIsSidebarOpen(false); }}><Users size={18} /> <span className="nav-label">Cashier Tracker</span></button>
            <button className="sidebar-nav-btn" style={navActive('Attachments')} onClick={() => { setActiveTab('Attachments'); setIsSidebarOpen(false); }}><Image size={18} /> <span className="nav-label">Attachments</span></button>
            <button className="sidebar-nav-btn" style={navActive('Procurement')} onClick={() => { setActiveTab('Procurement'); setIsSidebarOpen(false); }}><Package size={18} /> <span className="nav-label">Procurement</span></button>
            
            <div className="nav-divider" style={{ height: '1px', background: 'var(--border)', margin: '1rem 0.5rem' }} />
            <p className="nav-label" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 1rem 0.4rem' }}>Management</p>
            
            <button className="sidebar-nav-btn" style={navActive('Categories')} onClick={() => { setActiveTab('Categories'); setIsSidebarOpen(false); }}><SettingsIcon size={18} /> <span className="nav-label">Categories</span></button>
            <button className="sidebar-nav-btn" style={navActive('Settings')} onClick={() => { setActiveTab('Settings'); setIsSidebarOpen(false); }}><User size={18} /> <span className="nav-label">Settings</span></button>
          </div>
        </div>
        
        {/* Sticky Profile Section - Edge-to-edge */}
        <div className="sidebar-profile" style={{ 
            background: 'var(--glass-bg)', 
            borderTop: '1px solid var(--border)', 
            padding: '0.75rem 1.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div className="nav-label" style={{ overflow: 'hidden' }}>
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

            {activeTab === 'Overview' && activePhase && !isPhaseSettled && user?.role === 'ADMIN' && (
              <>
                <button
                  onClick={() => setShowReallocateModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '12px',
                    background: 'rgba(129, 140, 248, 0.1)',
                    color: '#818cf8',
                    border: '1px solid rgba(129, 140, 248, 0.2)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.background = 'rgba(129, 140, 248, 0.18)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'rgba(129, 140, 248, 0.1)';
                  }}
                >
                  <Layers size={16} /> Reallocate Rollover
                </button>
                <button
                  onClick={() => setShowSettleModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--success)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.18)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                  }}
                >
                  <CheckCircle size={16} /> Settle Phase
                </button>
              </>
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
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 12px var(--btn-primary-shadow)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.background = 'var(--btn-primary-hover)';
                  e.currentTarget.style.boxShadow = '0 6px 16px var(--btn-primary-shadow)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'var(--btn-primary-bg)';
                  e.currentTarget.style.boxShadow = '0 4px 12px var(--btn-primary-shadow)';
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
                isSettledProp={isPhaseSettled}
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
        {activeTab === 'Analytics' && (
            <Analytics 
                projectId={activeProject?.id} 
                projectName={activeProject?.name} 
                phaseId={activePhase?.id}
                key={`analytics-${refreshKey}`} 
            />
        )}
        {activeTab === 'Cashier Tracker' && (
            <CashierTracker
                projectId={activeProject?.id}
                projectName={activeProject?.name}
                phaseId={activePhase?.id}
                onTransferRequest={handleGraphTransfer}
                key={`cashier-${refreshKey}`}
            />
        )}
        {activeTab === 'Attachments' && (
            <ReceiptsGallery
                projectId={activeProject?.id}
                phaseId={activePhase?.id}
                key={`receipts-${refreshKey}`}
            />
        )}
        {activeTab === 'Categories' && <CategoryManager onRename={handleCategoryRename} userRole={user?.role} />}
        {activeTab === 'Settings' && <Settings activeProject={activeProject} onUpdate={refreshProjectData} user={user} />}
        {activeTab === 'Procurement' && (
            <ProcurementManager 
                projectId={activeProject?.id}
                activePhase={activePhase}
                phasesList={phasesList}
                onPrefillExpense={(expenseDetails) => {
                    setEditingTransaction({
                      description: expenseDetails.description,
                      amount: expenseDetails.amount,
                      actualAmount: expenseDetails.actualAmount,
                      cgst: expenseDetails.cgst,
                      sgst: expenseDetails.sgst,
                      igst: expenseDetails.igst,
                      discount: expenseDetails.discount,
                      attachmentUrl: expenseDetails.attachmentUrl,
                      phaseId: expenseDetails.phaseId,
                      date: new Date().toISOString()
                    });
                    setShowTransactionForm(true);
                }}
                key={`procurement-${refreshKey}`}
            />
        )}

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

        {showSettleModal && (
            <div className="modal-overlay" style={{
                position: 'fixed', inset: 0, 
                background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}>
                <div className="modal-content glass-panel animate-in" style={{ 
                    width: '100%', maxWidth: '480px', padding: '2rem', 
                    background: 'var(--background)', borderRadius: '24px', overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    display: 'flex', flexDirection: 'column', gap: '1.5rem',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Settle & Return Surplus</h3>
                        <button onClick={() => { setShowSettleModal(false); setSettleError(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ color: 'var(--text-muted)', fontSize: '0.925rem', lineHeight: '1.6' }}>
                        You are about to settle <strong style={{ color: 'var(--text-main)' }}>{activePhase?.name}</strong>. 
                        This action will officially close the accounts session for this phase.
                        Any remaining surplus balance will be automatically returned to College Management.
                    </div>

                    <div style={{ 
                        background: 'rgba(16, 185, 129, 0.08)', 
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem'
                    }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Surplus to return</span>
                        <span style={{ fontSize: '2rem', fontWeight: 850, color: 'var(--success)', fontFamily: 'monospace' }}>
                            {formatCurrency(currentBalanceForSettle)}
                        </span>
                    </div>

                    {settleError && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 }}>
                            ⚠️ {settleError}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button 
                            onClick={() => { setShowSettleModal(false); setSettleError(''); }} 
                            className="btn-secondary"
                            style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', fontWeight: 700 }}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSettlePhase} 
                            disabled={settleLoading}
                            style={{ 
                                flex: 1, 
                                padding: '0.75rem', 
                                borderRadius: '12px', 
                                fontWeight: 700,
                                background: settleLoading ? 'var(--surface-hover)' : 'var(--success)',
                                color: '#000000',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                opacity: settleLoading ? 0.6 : 1
                            }}
                        >
                            {settleLoading ? 'Processing...' : 'Confirm Settlement'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showReallocateModal && (
            <div className="modal-overlay" style={{
                position: 'fixed', inset: 0, 
                background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}>
                <div className="modal-content glass-panel animate-in" style={{ 
                    width: '100%', maxWidth: '520px', padding: '2rem', 
                    background: 'var(--background)', borderRadius: '24px', overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    display: 'flex', flexDirection: 'column', gap: '1.5rem',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Reallocate Surplus Fund</h3>
                        <button onClick={() => { setShowReallocateModal(false); setSelectedSourcePhaseId(''); setReallocateError(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ color: 'var(--text-muted)', fontSize: '0.925rem', lineHeight: '1.6' }}>
                        Select a closed (settled) phase below to roll over its unspent surplus directly into <strong style={{ color: 'var(--text-main)' }}>{activePhase?.name}</strong>.
                    </div>

                    {eligiblePhasesForReallocateModal.length === 0 ? (
                        <div style={{ 
                            padding: '2rem 1rem', 
                            background: 'var(--surface-hover)', 
                            borderRadius: '16px',
                            border: '1px dashed var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            gap: '0.5rem'
                        }}>
                            <span style={{ fontSize: '2rem' }}>📭</span>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>No Eligible Settled Phases</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>There are no closed phases with an available unspent surplus to reallocate.</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Source Phase</label>
                            <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '0.5rem', 
                                maxHeight: '200px', 
                                overflowY: 'auto',
                                paddingRight: '4px'
                            }}>
                                {eligiblePhasesForReallocateModal.map(p => (
                                    <div 
                                        key={p.id}
                                        onClick={() => setSelectedSourcePhaseId(p.id)}
                                        style={{
                                            padding: '1rem',
                                            borderRadius: '14px',
                                            background: selectedSourcePhaseId === p.id ? 'rgba(129, 140, 248, 0.08)' : 'var(--surface-hover)',
                                            border: selectedSourcePhaseId === p.id ? '2px solid #818cf8' : '1px solid var(--border)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--text-main)' }}>{p.name}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Settled on {new Date(p.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                        <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--success)', fontFamily: 'monospace' }}>
                                            +{formatCurrency(Number(p.returnedAmount))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {reallocateError && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600 }}>
                            ⚠️ {reallocateError}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button 
                            onClick={() => { setShowReallocateModal(false); setSelectedSourcePhaseId(''); setReallocateError(''); }} 
                            className="btn-secondary"
                            style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', fontWeight: 700 }}
                        >
                            Cancel
                        </button>
                        {eligiblePhasesForReallocateModal.length > 0 && (
                            <button 
                                onClick={handleReallocateSurplus} 
                                disabled={reallocateLoading || !selectedSourcePhaseId}
                                style={{ 
                                    flex: 1, 
                                    padding: '0.75rem', 
                                    borderRadius: '12px', 
                                    fontWeight: 700,
                                    background: reallocateLoading || !selectedSourcePhaseId ? 'var(--surface-hover)' : '#818cf8',
                                    color: '#000000',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    opacity: reallocateLoading || !selectedSourcePhaseId ? 0.6 : 1
                                }}
                            >
                                {reallocateLoading ? 'Processing...' : 'Confirm Reallocation'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
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
        <button className={`mobile-nav-item ${activeTab === 'Analytics' ? 'active' : ''}`} onClick={() => setActiveTab('Analytics')}>
          <PieChartIcon size={22} />
          <span>Analytics</span>
        </button>
        <button className={`mobile-nav-item ${activeTab === 'Cashier Tracker' ? 'active' : ''}`} onClick={() => setActiveTab('Cashier Tracker')}>
          <Users size={22} />
          <span>Cashiers</span>
        </button>
      </div>

      {/* Floating Action Button (FAB) at bottom-right corner */}
      {!isPhaseSettled && (activeTab === 'Journal' || activeTab === 'Overview') && (
        <button 
          className="fab-button"
          onClick={() => { setEditingTransaction(null); setShowTransactionForm(true); }}
          title="Add Transaction"
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
