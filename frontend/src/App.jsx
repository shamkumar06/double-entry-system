import React, { useState } from 'react';
import { Download, Home, ChevronLeft } from 'lucide-react';
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
import { accountingApi } from './services/api';
import { useSettings } from './context/SettingsContext';

function App() {
  const [activeProject, setActiveProject] = useState(null); // {id, name, ...}
  const [activePhase, setActivePhase] = useState(undefined); // undefined = phase screen, null = all, string = specific
  const [activeTab, setActiveTab] = useState('Overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPhases, setSelectedPhases] = useState([]);
  const [activeAccount, setActiveAccount] = useState('Cash');
  const { settings } = useSettings();

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      await accountingApi.generateReport(
        activeProject?.logical_id,
        activeProject?.name,
        activeTab,
        activePhase?.phase_id || null,
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
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error("Failed to sync project data:", e);
    }
  };

  const navActive = (tab) => ({
    textAlign: 'left',
    color: activeTab === tab ? 'var(--text-main)' : 'var(--text-muted)',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    background: activeTab === tab ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
    fontWeight: activeTab === tab ? 600 : 400,
    cursor: 'pointer',
    borderLeft: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
    transition: 'all 0.15s ease'
  });

  // Stage 1: Home Screen
  if (!activeProject) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
        <HomeScreen onSelectProject={(project) => { 
          setActiveProject(project); 
          setActivePhase(undefined); 
          setActiveTab('Overview'); 
        }} />
      </div>
    );
  }

  // Stage 2: Phase Selector
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
    const isPhaseSettled = activePhase?.name && activeProject?.phases 
        ? Object.values(activeProject.phases).find(p => p.phase_id === activePhase.phase_id)?.is_settled 
        : false;

    // Project dashboard
    return (
    <div className="app-container">
      <nav className="sidebar glass-panel" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
            {activeProject?.logo_url && <img src={activeProject.logo_url} alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px' }} />}
            <h1 className="text-gradient" style={{ fontSize: '1.4rem', fontWeight: 700 }}>Double Entry</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeProject?.name}
          </p>
          {/* Phase badge */}
          <div style={{ marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.6rem', borderRadius: '20px', background: 'rgba(2, 132, 199, 0.1)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
            🔖 {activePhase?.name || 'All Phases'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1.5rem' }}>
            <button style={navActive('Overview')} onClick={() => { setActiveTab('Overview'); setActivePhase(null); }}>📊  Overview</button>
            <button style={navActive('Journal')} onClick={() => setActiveTab('Journal')}>📖  Journal</button>
            <button style={navActive('Ledger')} onClick={() => setActiveTab('Ledger')}>📒  Ledger Pages</button>
            <button style={navActive('Trial Balance')} onClick={() => setActiveTab('Trial Balance')}>⚖️  Trial Balance</button>
            <button style={navActive('Reports')} onClick={() => setActiveTab('Reports')}>📄  Reports</button>
            <div style={{ height: '1px', background: 'var(--border)', margin: '0.75rem 0' }} />
            <button style={navActive('Categories')} onClick={() => setActiveTab('Categories')}>⚙️  Categories</button>
            <button style={navActive('Settings')} onClick={() => setActiveTab('Settings')}>👤  Settings</button>
            <button onClick={() => setActivePhase(undefined)}
              style={{ textAlign: 'left', color: 'var(--text-muted)', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', borderLeft: '3px solid transparent', transition: 'all 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'var(--surface)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
              🔀  Change Phase
            </button>
          </div>
        </div>
        <button onClick={() => setActiveProject(null)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'var(--surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
          <Home size={16} /> Projects
        </button>
      </nav>

      <main className="main-content">
        <button onClick={() => setActivePhase(undefined)} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          <ChevronLeft size={16} /> Back to Phases
        </button>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 600 }}>
              {activeTab === 'Overview' ? (activePhase ? 'Phase Summary' : 'Project Overview') : activeTab}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
              {activeProject?.name} {activePhase?.name ? `› ${activePhase.name}` : '› All Phases'}
            </p>
          </div>
          {activeTab === 'Overview' && (
            <button onClick={() => setShowEditModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border)', background: 'var(--surface)', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-main)' }}>
              ✏️ Edit Details
            </button>
          )}
          {activeTab === 'Journal' && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-primary"
                disabled={isPhaseSettled}
                onClick={() => {
                  if (isPhaseSettled) return;
                  setEditingTransaction(null);
                  setShowTransactionForm(true);
                }}
                style={isPhaseSettled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                {isPhaseSettled ? 'Phase Settled' : '+ New Transaction'}
              </button>
            </div>
          )}
        </header>

        {activeTab === 'Overview' && (
            <Dashboard 
                projectId={activeProject?.logical_id} 
                projectName={activeProject?.name}
                phaseId={activePhase?.phase_id}
                phaseName={activePhase?.name} 
                onSelectPhase={(ph) => {
                    setActivePhase(ph);
                }} 
                key={`dash-${refreshKey}`} 
            />
        )}
        {activeTab === 'Journal' && (
            <Journal 
                projectId={activeProject?.logical_id}
                projectName={activeProject?.name} 
                phaseId={activePhase?.phase_id}
                phaseName={activePhase?.name} 
                selectedPhases={selectedPhases} 
                setSelectedPhases={setSelectedPhases} 
                onEdit={(tx) => { setEditingTransaction(tx); setShowTransactionForm(true); }} 
                key={`journal-${refreshKey}`} 
            />
        )}
        {activeTab === 'Ledger' && (
            <Ledger 
                projectId={activeProject?.logical_id}
                projectName={activeProject?.name} 
                phaseId={activePhase?.phase_id}
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
                projectId={activeProject?.logical_id}
                projectName={activeProject?.name} 
                phaseId={activePhase?.phase_id}
                selectedPhases={selectedPhases} 
                setSelectedPhases={setSelectedPhases} 
                key={`tb-${refreshKey}`} 
            />
        )}
        {activeTab === 'Reports' && (
            <Reports 
                projectId={activeProject?.logical_id} 
                projectName={activeProject?.name} 
                phasesList={Object.values(activeProject.phases || {})} 
                key={`reports-${refreshKey}`} 
            />
        )}
        {activeTab === 'Categories' && <CategoryManager onRename={handleCategoryRename} />}
        {activeTab === 'Settings' && <Settings activeProject={activeProject} onUpdate={refreshProjectData} />}

        {showTransactionForm && (
          <TransactionForm
            projectId={activeProject?.logical_id}
            projectName={activeProject?.name}
            phaseId={activePhase?.phase_id}
            phaseName={activePhase?.name}
            initialData={editingTransaction}
            onCancel={() => { setShowTransactionForm(false); setEditingTransaction(null); }}
            onComplete={() => { setShowTransactionForm(false); setEditingTransaction(null); setRefreshKey(k => k + 1); }}
          />
        )}

        {showEditModal && (
          <EditOverviewModal
            project={activeProject}
            phaseObj={activePhase?.phase_id ? Object.entries(activeProject.phases || {}).map(([id, p]) => ({ id, ...p })).find(p => p.phase_id === activePhase.phase_id) : null}
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
      </main>
    </div>
  );
}

export default App;
