import React, { useState, useEffect } from 'react';
import { FileText, Download, Plus, Trash2, Check, Settings as SettingsIcon, Calendar, Type, Layout, Info } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { accountingApi } from '../services/api';

const STUDIO_STYLES = `
    .studio-section {
        background: white;
        border-radius: 12px;
        padding: 0.5rem 0;
        transition: all 0.2s;
    }
    /* MULTI-PAGE STACKER STYLES */
    .report-sheet {
        width: 210mm;
        min-height: 297mm;
        height: auto;
        background: white;
        margin-bottom: 25px; /* The "Floor Gap" */
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1);
        border: 1px solid #d1d5db;
        border-radius: 2px;
        padding: 20mm;
        font-family: "'Inter', 'Segoe UI', sans-serif";
        color: #000;
        position: relative;
        transition: all 0.3s;
    }
    
    .report-sheet:hover {
        box-shadow: 0 30px 60px -12px rgba(0,0,0,0.25);
    }
    
    .sheet-label {
        position: absolute;
        bottom: 10px;
        right: 20px;
        font-size: 0.6rem;
        font-weight: 700;
        color: #cbd5e1;
        text-transform: uppercase;
    }
    
    /* Ensure content doesn't get sliced */
    .a4-section-header, table tr, h2, h3 {
        break-inside: avoid-page !important;
        page-break-inside: avoid !important;
    }
    ::-webkit-scrollbar {
        width: 6px;
    }
    ::-webkit-scrollbar-track {
        background: transparent;
    }
    ::-webkit-scrollbar-thumb {
        background: #e2e8f0;
        border-radius: 10px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: #cbd5e1;
    }
`;

export default function Reports({ projectId, projectName, phasesList }) {
    const { settings, updateSettings } = useSettings();
    const config = settings.reportConfig;
    const [downloading, setDownloading] = useState(false);
    const [activeSectionTab, setActiveSectionTab] = useState('journal');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedPhaseIds, setSelectedPhaseIds] = useState([]);
    
    // Real Data for Preview
    const [journalData, setJournalData] = useState([]);
    const [ledgerData, setLedgerData] = useState({});
    const [trialBalanceData, setTrialBalanceData] = useState(null);
    const [loadingData, setLoadingData] = useState(false);
    const [allAccounts, setAllAccounts] = useState([]);

    useEffect(() => {
        // Fetch categories for the account selection list (Logical Codes included)
        accountingApi.listCategories().then(cats => {
            setAllAccounts(cats);
        });
    }, []);

    const fetchPreviewData = async () => {
        if (!projectId) return;
        setLoadingData(true);
        try {
            // 1. Journal (Using Logical IDs)
            const jData = await accountingApi.getJournal(projectId, selectedPhaseIds.length > 0 ? selectedPhaseIds.join(',') : null);
            let filteredJ = jData;
            if (startDate) filteredJ = filteredJ.filter(tx => tx.transaction_date >= startDate);
            if (endDate) filteredJ = filteredJ.filter(tx => tx.transaction_date <= endDate);
            setJournalData(filteredJ);

            // 2. Trial Balance (Using Logical IDs)
            const tb = await accountingApi.getTrialBalance(projectId, selectedPhaseIds.length > 0 ? selectedPhaseIds.join(',') : null);
            setTrialBalanceData(tb);

            // 3. Ledger (Using Logical IDs)
            const ledgerMap = {};
            const filterAccounts = config.ledgerAccounts && config.ledgerAccounts.length > 0 
                ? allAccounts.filter(a => config.ledgerAccounts.includes(a.name))
                : allAccounts.slice(0, 5); 
            
            for (const cat of filterAccounts) {
                const lEntries = await accountingApi.getLedger(projectId, cat.code, selectedPhaseIds.length > 0 ? selectedPhaseIds.join(',') : null);
                ledgerMap[cat.name] = lEntries;
            }
            setLedgerData(ledgerMap);

        } catch (e) {
            console.error("Preview fetch failed:", e);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchPreviewData();
    }, [projectId, selectedPhaseIds, startDate, endDate, config.ledgerAccounts, allAccounts]);

    // Update reportConfig
    const updateConfig = (partial) => {
        updateSettings({
            reportConfig: { ...config, ...partial }
        });
    };

    const handleAddSubHeader = () => {
        updateConfig({ subHeaders: [...config.subHeaders, { text: "", fontSize: 12 }] });
    };

    const handleUpdateSubHeader = (index, field, value) => {
        const newSubs = [...config.subHeaders];
        newSubs[index] = { ...newSubs[index], [field]: value };
        updateConfig({ subHeaders: newSubs });
    };

    const handleRemoveSubHeader = (index) => {
        updateConfig({ subHeaders: config.subHeaders.filter((_, i) => i !== index) });
    };

    const toggleLedgerAccount = (accName) => {
        const current = config.ledgerAccounts || [];
        const updated = current.includes(accName)
            ? current.filter(a => a !== accName)
            : [...current, accName];
        updateConfig({ ledgerAccounts: updated });
    };

    const toggleColumn = (section, column) => {
        const current = config.selectedColumns[section];
        const updated = current.includes(column)
            ? current.filter(c => c !== column)
            : [...current, column];
        
        updateConfig({
            selectedColumns: {
                ...config.selectedColumns,
                [section]: updated
            }
        });
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            // Backend generate_report modified to support project_id
            await accountingApi.generateReport(projectId, projectName, "Full", selectedPhaseIds, null, {
                custom_header: config.customHeader,
                sub_headers: config.subHeaders.map(sh => ({ text: sh.text, font_size: parseInt(sh.fontSize || 12) })),
                footer_note: config.footerNote,
                show_date_corner: config.showDateCorner,
                columns: config.selectedColumns,
                start_date: startDate,
                end_date: endDate,
                sections: settings.reportSections,
                date_format: settings.dateFormat,
                sort_order: settings.sortOrder,
                ledger_accounts: config.ledgerAccounts,
                header_font_size: parseInt(config.headerFontSize || 26)
            });
        } catch (e) {
            alert("Failed to generate report: " + e.message);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#f8fafc', overflow: 'hidden', margin: '-1.5rem' }}>
            <style>{STUDIO_STYLES}</style>
            
            {/* ── LEFT SIDEBAR: CONFIGURATION STUDIO ── */}
            <div style={{ 
                width: '400px', 
                background: 'white', 
                borderRight: '1px solid #e2e8f0', 
                display: 'flex', 
                flexDirection: 'column',
                boxShadow: '4px 0 12px rgba(0,0,0,0.03)',
                zIndex: 10
            }}>
                {/* Sidebar Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #ffffff, #f8faff)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ background: 'var(--primary)', color: 'white', padding: '0.6rem', borderRadius: '12px', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
                            <SettingsIcon size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b', letterSpacing: '-0.3px' }}>Report Studio</h3>
                            <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>V2.0 • Identity Powered</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleDownload}
                        disabled={downloading}
                        className="btn-primary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '0.8rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                        {downloading ? 'Generating...' : <><Download size={18} /> Download Word Doc</>}
                    </button>
                </div>

                {/* Scrollable Settings Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    
                    {/* SECTION 1: MASTER BRANDING */}
                    <div className="studio-section">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <Type size={16} color="var(--primary)" />
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Document Branding</label>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ position: 'relative' }}>
                                <input 
                                    type="text" 
                                    value={config.customHeader}
                                    onChange={e => updateConfig({ customHeader: e.target.value })}
                                    placeholder="Report Heading..."
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }} 
                                />
                            </div>
                            
                            {/* Header Font Size Slider */}
                            <div style={{ marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Header Scale</label>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>{config.headerFontSize || 26}pt</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="12" max="48" 
                                    value={config.headerFontSize || 26}
                                    onChange={e => updateConfig({ headerFontSize: parseInt(e.target.value) })}
                                    style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                    onClick={() => updateConfig({ showDateCorner: !config.showDateCorner })}
                                    style={{ 
                                        flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid',
                                        backgroundColor: config.showDateCorner ? 'rgba(34,197,94,0.08)' : '#f8fafc',
                                        borderColor: config.showDateCorner ? 'var(--success)' : '#e2e8f0',
                                        color: config.showDateCorner ? 'var(--success)' : '#94a3b8',
                                        fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    {config.showDateCorner ? <><Check size={12} /> DATE ON CORNER</> : 'DATE OFF'}
                                </button>
                                <button 
                                    onClick={() => updateConfig({ showFooterNote: !config.showFooterNote })}
                                    style={{ 
                                        flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid',
                                        backgroundColor: config.showFooterNote ? 'rgba(79,70,229,0.08)' : '#f8fafc',
                                        borderColor: config.showFooterNote ? 'var(--primary)' : '#e2e8f0',
                                        color: config.showFooterNote ? 'var(--primary)' : '#94a3b8',
                                        fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer'
                                    }}
                                >
                                    FOOTER {config.showFooterNote ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: DATA FILTERS */}
                    <div className="studio-section">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <Calendar size={16} color="var(--primary)" />
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data Selection</label>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Date Elements */}
                            <div>
                                <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Date Range</p>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="filter-input" style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                    <span style={{ color: '#94a3b8' }}>-</span>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="filter-input" style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                </div>
                            </div>

                            {/* Vertical Phase Filter */}
                            <div>
                                <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    Phase Filter
                                    <span style={{ fontSize: '0.65rem', fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(Shift+Click to multi-select)</span>
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <button 
                                        onClick={() => setSelectedPhaseIds([])}
                                        style={{ 
                                            padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                            background: selectedPhaseIds.length === 0 ? '#1e293b' : '#f1f5f9',
                                            color: selectedPhaseIds.length === 0 ? 'white' : '#64748b',
                                            border: 'none', textAlign: 'left', transition: 'all 0.2s', width: '100%'
                                        }}
                                    >
                                        Whole Project
                                    </button>
                                    {phasesList.map(ph => (
                                        <button 
                                            key={ph.phase_id}
                                            onClick={(e) => {
                                                if (e.shiftKey) {
                                                    setSelectedPhaseIds(prev => prev.includes(ph.phase_id) ? prev.filter(p => p !== ph.phase_id) : [...prev, ph.phase_id])
                                                } else {
                                                    setSelectedPhaseIds(prev => (prev.length === 1 && prev[0] === ph.phase_id) ? [] : [ph.phase_id])
                                                }
                                            }}
                                            style={{ 
                                                padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                                background: selectedPhaseIds.includes(ph.phase_id) ? 'var(--secondary)' : '#f1f5f9',
                                                color: selectedPhaseIds.includes(ph.phase_id) ? 'white' : '#64748b',
                                                border: 'none', textAlign: 'left', transition: 'all 0.2s', width: '100%'
                                            }}
                                        >
                                            {ph.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: LAYOUT & COLUMNS */}
                    <div className="studio-section">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <Layout size={16} color="var(--primary)" />
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Structure & Tables</label>
                        </div>
                        
                        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', background: 'white', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                {['journal', 'ledger', 'trialBalance'].map(s => (
                                    <button 
                                        key={s}
                                        onClick={() => setActiveSectionTab(s)}
                                        style={{ 
                                            flex: 1, fontSize: '0.65rem', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer',
                                            background: activeSectionTab === s ? 'var(--primary)' : 'transparent',
                                            color: activeSectionTab === s ? 'white' : '#64748b',
                                            border: 'none', fontWeight: 700
                                        }}
                                    >
                                        {s === 'trialBalance' ? 'TB' : s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                ))}
                            </div>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                {["Date", "Phase", "From", "To", "Category", "Description", "Amount", "Debit", "Credit", "Running Balance", "Account Name", "Debit Balance", "Credit Balance"]
                                 .filter(col => {
                                     if (activeSectionTab === 'journal') return ["Date", "Phase", "From", "To", "Category", "Description", "Amount"].includes(col);
                                     if (activeSectionTab === 'ledger') return ["Date", "Phase", "Debit", "Credit", "Running Balance"].includes(col);
                                     return ["Account Name", "Debit Balance", "Credit Balance"].includes(col);
                                 })
                                 .map(col => (
                                    <button 
                                        key={col} 
                                        onClick={() => toggleColumn(activeSectionTab, col)}
                                        style={{ 
                                            fontSize: '0.65rem', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer',
                                            background: config.selectedColumns[activeSectionTab].includes(col) ? 'rgba(79,70,229,0.1)' : 'white',
                                            color: config.selectedColumns[activeSectionTab].includes(col) ? 'var(--primary)' : '#94a3b8',
                                            border: '1px solid ' + (config.selectedColumns[activeSectionTab].includes(col) ? 'var(--primary)' : '#e2e8f0'),
                                            display: 'flex', alignItems: 'center', gap: '0.25rem'
                                        }}
                                    >
                                        {config.selectedColumns[activeSectionTab].includes(col) && <Check size={10} />} {col}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: LEDGER ACCOUNTS */}
                    <div className="studio-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Accounts Filter</label>
                            {(config.ledgerAccounts || []).length > 0 && (
                                <button onClick={() => updateConfig({ ledgerAccounts: [] })} style={{ fontSize: '0.65rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Reset</button>
                            )}
                        </div>
                        <div style={{ 
                            maxHeight: '180px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.35rem', 
                            padding: '0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0',
                            scrollbarWidth: 'thin'
                        }}>
                            {allAccounts.map(acc => (
                                <button 
                                    key={acc.code || acc.name}
                                    onClick={() => toggleLedgerAccount(acc.name)}
                                    style={{ 
                                        fontSize: '0.65rem', padding: '0.35rem 0.65rem', borderRadius: '6px', cursor: 'pointer',
                                        background: (config.ledgerAccounts || []).includes(acc.name) ? 'var(--primary)' : 'white',
                                        color: (config.ledgerAccounts || []).includes(acc.name) ? 'white' : '#64748b',
                                        border: '1px solid ' + ((config.ledgerAccounts || []).includes(acc.name) ? 'var(--primary)' : '#e2e8f0'),
                                        transition: 'all 0.1s'
                                    }}
                                >
                                    {acc.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SECTION 5: METADATA LINES */}
                    <div className="studio-section" style={{ paddingBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sub-Headers</label>
                            <button onClick={handleAddSubHeader} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.65rem', borderRadius: '6px' }}>
                                <Plus size={12} /> Add
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {config.subHeaders.map((sub, i) => (
                                <div key={i} style={{ padding: '0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input 
                                            type="text" 
                                            value={sub.text} 
                                            onChange={e => handleUpdateSubHeader(i, 'text', e.target.value)} 
                                            placeholder="Line Title..."
                                            style={{ fontSize: '0.8rem', padding: '0.4rem', border: 'none', background: 'transparent', borderBottom: '1px solid #cbd5e1', flex: 1, fontWeight: 500 }}
                                        />
                                        <button onClick={() => handleRemoveSubHeader(i)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input 
                                            type="range" min="8" max="24" 
                                            value={sub.fontSize || 12} 
                                            onChange={e => handleUpdateSubHeader(i, 'fontSize', e.target.value)}
                                            style={{ flex: 1, height: '3px' }}
                                        />
                                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)' }}>{sub.fontSize || 12}pt</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SECTION 6: FOOTER REMARK */}
                    {config.showFooterNote && (
                        <div className="studio-section">
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'block' }}>Footer Note</label>
                            <textarea 
                                value={config.footerNote}
                                onChange={e => updateConfig({ footerNote: e.target.value })}
                                placeholder='Professional disclaimer...'
                                style={{ minHeight: '80px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', padding: '0.75rem', fontSize: '0.8rem', background: '#f8fafc' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ── RIGHT CANVAS: A4 PREVIEW WORKSPACE ── */}
            <div style={{ 
                flex: 1, 
                overflow: 'auto', 
                background: '#f1f5f9', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4rem 2rem',
                position: 'relative'
            }}>
                {/* Visual Hint */}
                <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 100 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }}></div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Studio Floor • Separate Sheets View</span>
                </div>

                {loadingData ? (
                    <div className="report-sheet" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <div style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>Drafting Live Preview...</div>
                    </div>
                ) : (
                    <>
                        {/* SHEET 1: HEADER & JOURNAL */}
                        {(settings.reportSections.journal || config.customHeader) && (
                            <div className="report-sheet">
                                <span className="sheet-label">Sheet 1: Overview</span>
                                {config.showDateCorner && (
                                    <div style={{ textAlign: 'right', fontSize: '10pt', marginBottom: '0.5cm', color: '#666' }}>
                                        Draft Date: {new Date().toLocaleDateString('en-GB')}
                                    </div>
                                )}
                                <div style={{ textAlign: 'center', marginBottom: '1.2cm' }}>
                                    <h1 style={{ fontSize: `${config.headerFontSize || 26}pt`, fontWeight: 'bold', margin: '0 0 0.3cm 0', color: '#000', textTransform: 'uppercase' }}>
                                        {config.customHeader || projectName}
                                    </h1>
                                    <div style={{ width: '80%', height: '2px', background: '#000', margin: '0 auto 0.4cm' }}></div>
                                    {config.subHeaders.map((sub, i) => (
                                        <p key={i} style={{ fontSize: `${sub.fontSize || 12}pt`, margin: '0.1cm 0', color: '#333', fontWeight: 500 }}>{sub.text}</p>
                                    ))}
                                </div>

                                {settings.reportSections.journal && (
                                    <div style={{ marginBottom: '0.5cm' }}>
                                        <h2 style={{ fontSize: '18pt', fontWeight: 'bold', borderBottom: '2pt solid #000', paddingBottom: '0.1cm', marginBottom: '0.6cm' }}>I. Journal Entries</h2>
                                        {journalData.length === 0 ? <p style={{ fontSize: '10pt', fontStyle: 'italic', color: '#666' }}>No transactions found.</p> : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                                                <thead>
                                                    <tr style={{ background: '#f0f0f0' }}>
                                                        {config.selectedColumns.journal.map(c => (<th key={c} style={{ border: '1px solid #000', padding: '8pt', textAlign: 'left' }}>{c}</th>))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {journalData.map((tx, idx) => (
                                                        <tr key={idx} style={{ breakInside: 'avoid' }}>
                                                            {config.selectedColumns.journal.map(col => {
                                                                let val = "-";
                                                                if (col === "Date") val = tx.transaction_date;
                                                                if (col === "Amount") val = `Rs. ${tx.amount?.toLocaleString()}`;
                                                                if (col === "Phase") val = tx.phase_name || 'Whole Project';
                                                                if (col === "From") val = tx.from_name;
                                                                if (col === "To") val = tx.to_name;
                                                                if (col === "Category") val = tx.category_name;
                                                                if (col === "Description") val = tx.description;
                                                                return <td key={col} style={{ border: '1px solid #000', padding: '8pt' }}>{val}</td>;
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SHEET 2+: LEDGER ACCOUNTS */}
                        {settings.reportSections.ledger && Object.entries(ledgerData).filter(([name]) => !config.ledgerAccounts?.length || config.ledgerAccounts.includes(name)).map(([accName, entries], idx) => (
                            <div className="report-sheet" key={accName}>
                                <span className="sheet-label">Sheet {idx + 2}: Ledger - {accName}</span>
                                {idx === 0 && <h2 style={{ fontSize: '18pt', fontWeight: 'bold', borderBottom: '2pt solid #000', paddingBottom: '0.1cm', marginBottom: '0.8cm' }}>II. General Ledger</h2>}
                                <div style={{ marginBottom: '0.5cm' }}>
                                    <h3 style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '0.4cm', display: 'flex', alignItems: 'center', gap: '0.5cm' }}>
                                        Account: {accName}
                                        <div style={{ height: '1px', flex: 1, background: '#ccc' }}></div>
                                    </h3>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                                        <thead>
                                            <tr style={{ background: '#f5f5f5' }}>
                                                {config.selectedColumns.ledger.map(c => (<th key={c} style={{ border: '1px solid #000', padding: '8pt', textAlign: 'left' }}>{c}</th>))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {entries.map((entry, eIdx) => (
                                                <tr key={eIdx} style={{ breakInside: 'avoid' }}>
                                                    {config.selectedColumns.ledger.map(col => {
                                                        let val = "-";
                                                        if (col === "Date") val = entry.date?.split('T')[0];
                                                        if (col === "Phase") val = entry.phase_name || 'Whole Project';
                                                        if (col === "Debit") val = entry.entry_type === 'Debit' ? entry.amount?.toLocaleString() : '-';
                                                        if (col === "Credit") val = entry.entry_type === 'Credit' ? entry.amount?.toLocaleString() : '-';
                                                        if (col === "Running Balance") val = `Rs. ${entry.running_balance?.toLocaleString()}`;
                                                        return <td key={col} style={{ border: '1px solid #000', padding: '8pt' }}>{val}</td>;
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}

                        {/* FINAL SHEET: TRIAL BALANCE & FOOTER */}
                        {(settings.reportSections.trialBalance || config.showFooterNote) && (
                            <div className="report-sheet">
                                <span className="sheet-label">Final Sheet</span>
                                {settings.reportSections.trialBalance && trialBalanceData && (
                                    <div style={{ marginBottom: '0.5cm' }}>
                                        <h2 style={{ fontSize: '18pt', fontWeight: 'bold', borderBottom: '2pt solid #000', paddingBottom: '0.1cm', marginBottom: '0.6cm' }}>III. Trial Balance</h2>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }}>
                                            <thead>
                                                <tr style={{ background: '#f0f0f0' }}>
                                                    {config.selectedColumns.trialBalance.map(c => (<th key={c} style={{ border: '1px solid #000', padding: '10pt', textAlign: 'left' }}>{c}</th>))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(trialBalanceData.accounts).map(([name, data]) => (
                                                    <tr key={name} style={{ breakInside: 'avoid' }}>
                                                        {config.selectedColumns.trialBalance.map(col => {
                                                            let val = "-";
                                                            if (col === "Account Name") val = name;
                                                            if (col === "Debit Balance") val = data.balance > 0 ? data.balance.toLocaleString() : '-';
                                                            if (col === "Credit Balance") val = data.balance < 0 ? Math.abs(data.balance).toLocaleString() : '-';
                                                            return <td key={col} style={{ border: '1px solid #000', padding: '10pt' }}>{val}</td>;
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {config.showFooterNote && (
                                    <div style={{ marginTop: '2cm', borderTop: '1px dashed #cbd5e1', paddingTop: '10mm' }}>
                                      <p style={{ fontSize: '9pt', color: '#64748b', fontStyle: 'italic', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                        {config.footerNote}
                                      </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
