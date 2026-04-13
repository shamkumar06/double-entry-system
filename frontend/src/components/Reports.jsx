import React, { useState, useEffect } from 'react';
import { Download, Plus, Trash2, Check, Settings as SettingsIcon, Calendar, Type, Layout, Activity, Layers, ChevronDown, Edit3 } from 'lucide-react';
import { useSettings, useFormatting } from '../context/SettingsContext';
import { accountingApi } from '../services/api';
import { parseDescription } from '../utils/descriptionParser';

const STUDIO_STYLES = `
    .studio-section {
        background: white;
        border-radius: 12px;
        padding: 0.5rem 0;
        transition: all 0.2s;
    }
    .report-sheet {
        width: 210mm;
        min-height: 297mm;
        height: auto;
        background: white;
        margin-bottom: 25px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1);
        border: 1px solid #d1d5db;
        border-radius: 2px;
        padding: 20mm;
        font-family: "'Inter', 'Segoe UI', sans-serif";
        color: #000;
        position: relative;
        transition: all 0.3s;
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
    .studio-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 1.25rem;
        margin-bottom: 1rem;
        transition: all 0.2s;
    }
    .studio-card:hover {
        border-color: var(--primary);
    }
    .context-settings-active {
        border-left: 4px solid var(--primary);
        background: white;
    }
`;

export default function Reports({ projectId, projectName, phasesList }) {
    const { settings, updateSettings } = useSettings();
    const { formatCurrency } = useFormatting();
    const config = settings.reportConfig || {
        customHeader: projectName || '',
        headerFontSize: 26,
        showTitleLine: true,
        showDateCorner: true,
        reportDate: new Date().toISOString().split('T')[0],
        showFooterNote: true,
        useRomanNumerals: true,
        combineLedgerAccounts: false,
        footerNote: 'Financial report generated automatically.',
        subHeaders: [],
        selectedColumns: {
            journal: ["Date", "Phase", "Category", "Description", "Amount"],
            ledger: ["Date", "Phase", "Debit", "Credit", "Running Balance"],
            trialBalance: ["Account Name", "Debit Balance", "Credit Balance"]
        },
        ledgerAccounts: []
    };
    
    const [downloading, setDownloading] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedPhaseIds, setSelectedPhaseIds] = useState([]);
    const [journalData, setJournalData] = useState([]);
    const [ledgerData, setLedgerData] = useState({});
    const [trialBalanceData, setTrialBalanceData] = useState(null);
    const [loadingData, setLoadingData] = useState(false);
    const [allAccounts, setAllAccounts] = useState([]);
    const [localPhases, setLocalPhases] = useState([]);
    const [expandedSections, setExpandedSections] = useState({ journal: true, ledger: false, tb: false });

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    useEffect(() => {
        accountingApi.listCategories().then(cats => setAllAccounts(cats));
        if (projectId) {
            accountingApi.listPhases(projectId).then(setLocalPhases).catch(console.error);
        }
    }, [projectId]);

    const fetchPreviewData = async () => {
        if (!projectId) return;
        setLoadingData(true);
        try {
            const jData = await accountingApi.getJournal(projectId, selectedPhaseIds.length > 0 ? selectedPhaseIds.join(',') : null);
            let filteredJ = jData;
            // Bug 2 fix: tx.date is the actual ISO date field. Slice to YYYY-MM-DD for comparison.
            if (startDate) filteredJ = filteredJ.filter(tx => (tx.date || '').slice(0, 10) >= startDate);
            if (endDate) filteredJ = filteredJ.filter(tx => (tx.date || '').slice(0, 10) <= endDate);
            setJournalData(filteredJ);

            const tb = await accountingApi.getTrialBalance(projectId, selectedPhaseIds.length > 0 ? selectedPhaseIds.join(',') : null);
            setTrialBalanceData(tb);

            const ledgerMap = {};
            const filterAccounts = config.ledgerAccounts?.length > 0 
                ? allAccounts.filter(a => config.ledgerAccounts.includes(a.name))
                : allAccounts; // Show all accounts when none are specifically chosen

            // Fetch all ledger accounts in parallel (Bug 4 fix: was a sequential loop)
            const ledgerResults = await Promise.all(
                filterAccounts.map(cat =>
                    accountingApi.getLedger(projectId, cat.id, selectedPhaseIds.length > 0 ? selectedPhaseIds.join(',') : null)
                        .then(entries => ({ name: cat.name, entries: Array.isArray(entries) ? entries : [] }))
                        .catch(() => ({ name: cat.name, entries: [] }))
                )
            );
            // Only keep accounts that actually have transactions
            const populatedResults = ledgerResults.filter(r => r.entries.length > 0);
            const newLedgerMap = {};
            populatedResults.forEach(({ name, entries }) => { newLedgerMap[name] = entries; });
            setLedgerData(newLedgerMap);

        } catch (e) {
            console.error("Preview fetch failed:", e);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchPreviewData();
    }, [projectId, selectedPhaseIds, startDate, endDate, config.ledgerAccounts, allAccounts]);

    const updateConfig = (partial) => {
        updateSettings({ reportConfig: { ...config, ...partial } });
    };

    const handleUpdateSubHeader = (i, field, val) => {
        const newSubs = [...(config.subHeaders || [])];
        newSubs[i] = { ...newSubs[i], [field]: val };
        updateConfig({ subHeaders: newSubs });
    };

    const toggleColumn = (section, column) => {
        const current = config.selectedColumns[section] || [];
        const updated = current.includes(column) ? current.filter(c => c !== column) : [...current, column];
        updateConfig({ selectedColumns: { ...config.selectedColumns, [section]: updated } });
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            await accountingApi.generateReport(projectId, projectName, "Full", selectedPhaseIds.length > 0 ? selectedPhaseIds.join(',') : null, {
                custom_header: config.customHeader,
                sub_headers: config.subHeaders?.map(sh => ({ text: sh.text, font_size: parseInt(sh.fontSize || 12) })),
                footer_note: config.footerNote,
                show_date_corner: config.showDateCorner,
                columns: config.selectedColumns,
                start_date: startDate,
                end_date: endDate,
                sections: settings.reportSections,
                use_roman_numerals: config.useRomanNumerals !== false,
                combine_ledger_accounts: config.combineLedgerAccounts === true,
                report_date: config.reportDate,
                date_format: settings.dateFormat,
                sort_order: settings.sortOrder,
                ledger_accounts: config.ledgerAccounts,
                header_font_size: parseInt(config.headerFontSize || 26),
                show_title_line: !!config.showTitleLine
            });
        } catch (e) {
            alert("Failed to generate report: " + e.message);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#f1f5f9', overflow: 'hidden', margin: '-1.5rem' }}>
            <style>{STUDIO_STYLES}</style>
            
            {/* ── LEFT SIDEBAR: ORDERLY STUDIO ── */}
            <div style={{ width: '420px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
                {/* STUDIO HEADER */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div style={{ background: 'var(--primary)', color: 'white', padding: '0.6rem', borderRadius: '12px' }}><SettingsIcon size={20} /></div>
                        <div>
                            <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e293b' }}>Report Studio</h3>
                            <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>IDENTITY POWERED • V2.0</p>
                        </div>
                    </div>
                    <button onClick={handleDownload} disabled={downloading} className="btn-primary" style={{ width: '100%', gap: '0.5rem', padding: '0.85rem' }}>
                        {downloading ? 'Drafting Report...' : <><Download size={18} /> Download Word Doc</>}
                    </button>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button onClick={() => updateConfig({ showFooterNote: !config.showFooterNote })} className={`btn-secondary ${config.showFooterNote ? 'active' : ''}`} style={{ flex: 1, fontSize: '0.7rem', fontWeight: 700 }}>
                            FOOTER {config.showFooterNote ? 'ON' : 'OFF'}
                        </button>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                        <button onClick={() => updateConfig({ useRomanNumerals: !config.useRomanNumerals })} className={`btn-secondary ${config.useRomanNumerals !== false ? 'active' : ''}`} style={{ width: '100%', fontSize: '0.7rem', fontWeight: 700 }}>
                            {config.useRomanNumerals !== false ? '✓ ROMAN NUMERAL HEADINGS' : 'STANDARD NUMBERING (1, 2, 3)'}
                        </button>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                        <button onClick={() => updateConfig({ combineLedgerAccounts: !config.combineLedgerAccounts })} className={`btn-secondary ${config.combineLedgerAccounts ? 'active' : ''}`} style={{ width: '100%', fontSize: '0.7rem', fontWeight: 700 }}>
                            {config.combineLedgerAccounts ? '✓ LEDGER COMBINED IN 1 TABLE' : 'SEPARATE LEDGER TABLES PER ACCOUNT'}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* SECTION 1: TITLE & BRANDING */}
                    <div className="studio-section">
                        <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>1. Title & Branding</label>
                        <div className="studio-card">
                            <input 
                                type="text" value={config.customHeader} onChange={e => updateConfig({ customHeader: e.target.value })} 
                                placeholder="Main Report Title..." 
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }} 
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Font Size</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>{config.headerFontSize || 26}pt</span>
                            </div>
                            <input type="range" min="14" max="42" value={config.headerFontSize || 26} onChange={e => updateConfig({ headerFontSize: parseInt(e.target.value) })} style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }} />
                            
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                <input type="checkbox" checked={config.showTitleLine} onChange={e => updateConfig({ showTitleLine: e.target.checked })} />
                                Show line below title
                            </label>

                            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <input type="checkbox" checked={config.showDateCorner} onChange={e => updateConfig({ showDateCorner: e.target.checked })} />
                                    Show Date in Top Corner
                                </label>
                                {config.showDateCorner && (
                                    <input 
                                        type="date" 
                                        value={config.reportDate} 
                                        onChange={e => updateConfig({ reportDate: e.target.value })} 
                                        style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} 
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: SUB-HEADINGS */}
                    <div className="studio-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                             <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>2. Sub-headings</label>
                             <button onClick={() => updateConfig({ subHeaders: [...(config.subHeaders || []), { text: "", fontSize: 12 }] })} style={{ color: 'var(--primary)', background: 'none', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>+ Add Line</button>
                        </div>
                        {(config.subHeaders || []).map((sh, idx) => (
                            <div key={idx} className="studio-card" style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <input type="text" value={sh.text} onChange={e => handleUpdateSubHeader(idx, 'text', e.target.value)} placeholder="Sub-heading text..." style={{ flex: 1, border: 'none', background: 'transparent', fontWeight: 500, fontSize: '0.9rem', borderBottom: '1px solid #cbd5e1' }} />
                                    <button onClick={() => updateConfig({ subHeaders: config.subHeaders.filter((_, i) => i !== idx) })} style={{ color: '#ef4444', background: 'none', border: 'none' }}><Trash2 size={14} /></button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <input type="range" min="8" max="20" value={sh.fontSize || 12} onChange={e => handleUpdateSubHeader(idx, 'fontSize', parseInt(e.target.value))} style={{ flex: 1, height: '4px', cursor: 'pointer' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{sh.fontSize || 12}pt</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* SECTION 3: DATA RANGE */}
                    <div className="studio-section">
                        <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>3. Data Range & Phases</label>
                        <div className="studio-card">
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} />
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <button onClick={() => setSelectedPhaseIds([])} style={{ width: '100%', textAlign: 'left', padding: '0.6rem', borderRadius: '8px', border: 'none', background: selectedPhaseIds.length === 0 ? '#1e293b' : '#f1f5f9', color: selectedPhaseIds.length === 0 ? 'white' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>Whole Project</button>
                                {localPhases.map(ph => (
                                    <button key={ph.id} onClick={(e) => e.shiftKey ? setSelectedPhaseIds(p => p.includes(ph.id) ? p.filter(id => id !== ph.id) : [...p, ph.id]) : setSelectedPhaseIds([ph.id]) } style={{ width: '100%', textAlign: 'left', padding: '0.6rem', borderRadius: '8px', border: 'none', background: selectedPhaseIds.includes(ph.id) ? 'var(--secondary)' : '#f1f5f9', color: selectedPhaseIds.includes(ph.id) ? 'white' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{ph.name}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: TABLE LAB */}
                    <div className="studio-section">
                        <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>4. Structure & Tables</label>
                        
                        <div className={`studio-card ${settings.reportSections.journal ? 'context-settings-active' : ''}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSettings({ reportSections: { ...settings.reportSections, journal: !settings.reportSections.journal } })}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <input type="checkbox" checked={settings.reportSections.journal} readOnly />
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Journal Entries</span>
                                </div>
                                <ChevronDown size={18} style={{ transform: expandedSections.journal ? 'rotate(180deg)' : '', transition: '0.2s' }} onClick={(e) => { e.stopPropagation(); setExpandedSections(p => ({ ...p, journal: !p.journal })) }} />
                            </div>
                            {expandedSections.journal && settings.reportSections.journal && (
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    {["Date", "Phase", "From", "To", "Category", "Description", "Amount"].map(col => (
                                        <button key={col} onClick={() => toggleColumn('journal', col)} style={{ fontSize: '0.65rem', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer', background: config.selectedColumns.journal.includes(col) ? 'rgba(79,70,229,0.1)' : 'white', color: config.selectedColumns.journal.includes(col) ? 'var(--primary)' : '#94a3b8', border: '1px solid ' + (config.selectedColumns.journal.includes(col) ? 'var(--primary)' : '#e2e8f0') }}>{col}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={`studio-card ${settings.reportSections.ledger ? 'context-settings-active' : ''}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSettings({ reportSections: { ...settings.reportSections, ledger: !settings.reportSections.ledger } })}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <input type="checkbox" checked={settings.reportSections.ledger} readOnly />
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>General Ledger</span>
                                </div>
                                <ChevronDown size={18} style={{ transform: expandedSections.ledger ? 'rotate(180deg)' : '', transition: '0.2s' }} onClick={(e) => { e.stopPropagation(); setExpandedSections(p => ({ ...p, ledger: !p.ledger })) }} />
                            </div>
                            {expandedSections.ledger && settings.reportSections.ledger && (
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.4rem' }}>COLUMNS</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                                        {["Date", "Phase", "Debit", "Credit", "Running Balance"].map(col => (
                                            <button key={col} onClick={() => toggleColumn('ledger', col)} style={{ fontSize: '0.65rem', padding: '0.35rem 0.65rem', borderRadius: '6px', background: config.selectedColumns.ledger.includes(col) ? 'rgba(79,70,229,0.1)' : 'white', color: config.selectedColumns.ledger.includes(col) ? 'var(--primary)' : '#94a3b8', border: '1px solid #e2e8f0' }}>{col}</button>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.4rem' }}>ACCOUNTS</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxHeight: '100px', overflowY: 'auto' }}>
                                        {allAccounts.map(acc => (
                                            <button key={acc.id} onClick={() => updateConfig({ ledgerAccounts: config.ledgerAccounts.includes(acc.name) ? config.ledgerAccounts.filter(a => a !== acc.name) : [...config.ledgerAccounts, acc.name] })} style={{ fontSize: '0.6rem', padding: '0.3rem 0.5rem', borderRadius: '6px', background: config.ledgerAccounts.includes(acc.name) ? 'var(--primary)' : 'white', color: config.ledgerAccounts.includes(acc.name) ? 'white' : '#64748b', border: '1px solid #e2e8f0' }}>{acc.name}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={`studio-card ${settings.reportSections.trialBalance ? 'context-settings-active' : ''}`}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSettings({ reportSections: { ...settings.reportSections, trialBalance: !settings.reportSections.trialBalance } })}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <input type="checkbox" checked={settings.reportSections.trialBalance} readOnly />
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Trial Balance</span>
                                </div>
                                <ChevronDown size={18} style={{ transform: expandedSections.tb ? 'rotate(180deg)' : '', transition: '0.2s' }} onClick={(e) => { e.stopPropagation(); setExpandedSections(p => ({ ...p, tb: !p.tb })) }} />
                            </div>
                            {expandedSections.tb && settings.reportSections.trialBalance && (
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    {["Account Name", "Debit Balance", "Credit Balance"].map(col => (
                                        <button key={col} onClick={() => toggleColumn('trialBalance', col)} style={{ fontSize: '0.65rem', padding: '0.4rem 0.6rem', borderRadius: '6px', background: config.selectedColumns.trialBalance.includes(col) ? 'rgba(79,70,229,0.1)' : 'white', color: config.selectedColumns.trialBalance.includes(col) ? 'var(--primary)' : '#94a3b8', border: '1px solid ' + (config.selectedColumns.trialBalance.includes(col) ? 'var(--primary)' : '#e2e8f0') }}>{col}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: '2rem', left: '2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>LIVE STUDIO PREVIEW • SHEET VIEW</span>
                </div>

                <div className="report-sheet">
                    <span className="sheet-label">LIVE PREVIEW</span>
                    {config.showDateCorner && <div style={{ textAlign: 'right', fontSize: '10pt', color: '#64748b', marginBottom: '0.5cm' }}>{config.reportDate ? new Date(config.reportDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</div>}
                    <div style={{ textAlign: 'center', marginBottom: '1.2cm' }}>
                        <h1 style={{ fontSize: `${config.headerFontSize || 26}pt`, fontWeight: 800, marginBottom: '0.4cm', color: '#000', textTransform: 'uppercase' }}>{config.customHeader || projectName}</h1>
                        {config.showTitleLine && <div style={{ height: '3px', width: '80%', background: '#000', margin: '0 auto 0.5cm' }}></div>}
                        {(config.subHeaders || []).map((sh, idx) => <p key={idx} style={{ fontSize: `${sh.fontSize || 12}pt`, fontWeight: 600, color: '#334155', margin: '0.1cm 0' }}>{sh.text}</p>)}
                    </div>

                    {(() => {
                        let sectionNumber = 1;
                        const getHeadingParams = () => {
                            const romans = ["I", "II", "III", "IV", "V", "VI", "VII"];
                            const num = config.useRomanNumerals !== false ? (romans[sectionNumber - 1] || sectionNumber) : sectionNumber;
                            sectionNumber++;
                            return `${num}. `;
                        };

                        return (
                            <>
                                {settings.reportSections.journal && (
                                    <div style={{ marginBottom: '1cm' }}>
                                         <h2 style={{ fontSize: '18pt', fontWeight: 800, borderBottom: '2.5pt solid #000', paddingBottom: '0.1cm', marginBottom: '0.6cm' }}>{getHeadingParams()}JOURNAL ENTRIES</h2>
                             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                                <thead><tr style={{ background: '#f8fafc' }}>{(config.selectedColumns.journal || []).map(c => <th key={c} style={{ border: '1px solid #000', padding: '8pt', textAlign: 'left' }}>{c}</th>)}</tr></thead>
                                <tbody>
                                    {journalData.length > 0 ? journalData.map((tx, idx) => {
                                        let primaryAccount = tx.lines?.find(l => l.type === 'DEBIT')?.account?.name || '-';
                                        let txAmount = tx.lines?.[0]?.amount || 0;
                                        let pureDesc = tx.description;
                                        let fromName = '-';
                                        let toName = '-';
                                        
                                        if (tx.description?.includes('| From:')) {
                                            const parts = tx.description.split('|');
                                            pureDesc = parts[0]?.trim();
                                            const fromToMatch = parts[1]?.match(/From: (.*?) To: (.*)/);
                                            if (fromToMatch) {
                                                fromName = fromToMatch[1]?.trim();
                                                toName = fromToMatch[2]?.trim();
                                            }
                                        }

                                        return (
                                        <tr key={idx}>
                                            {config.selectedColumns.journal.map(col => {
                                                let val = "-";
                                                if (col === "Date") val = tx.date ? formatDate(tx.date) : '-';
                                                if (col === "Amount") val = formatCurrency(txAmount);
                                                if (col === "Phase") val = tx.phase?.name || 'Project';
                                                if (col === "Category") val = primaryAccount;
                                                if (col === "Description") val = pureDesc;
                                                if (col === "From") val = fromName;
                                                if (col === "To") val = toName;
                                                return <td key={col} style={{ border: '1px solid #000', padding: '8pt' }}>{val}</td>;
                                            })}
                                        </tr>
                                        );
                                    }) : <tr><td colSpan={config.selectedColumns.journal.length} style={{ border: '1px solid #000', padding: '20pt', textAlign: 'center', fontStyle: 'italic', color: '#94a3b8' }}>Select dates or phases to see data.</td></tr>}
                                </tbody>
                             </table>
                        </div>
                                )}

                                {settings.reportSections.ledger && (
                                    <div style={{ marginBottom: '1cm' }}>
                                        <h2 style={{ fontSize: '18pt', fontWeight: 800, borderBottom: '2.5pt solid #000', paddingBottom: '0.1cm', marginBottom: '0.8cm' }}>{getHeadingParams()}GENERAL LEDGER</h2>
                                        
                                        {config.combineLedgerAccounts ? (() => {
                                            const getDrCr = (amt, type) => {
                                                const val = parseFloat(amt);
                                                const isNormalDebit = ['ASSET', 'EXPENSE'].includes(type);
                                                if (isNormalDebit) return val >= 0 ? 'Dr' : 'Cr';
                                                return val >= 0 ? 'Cr' : 'Dr';
                                            };
                                            const allEntries = [];
                                            Object.entries(ledgerData).forEach(([acc, entries]) => {
                                                entries.forEach(e => allEntries.push({ ...e, accountName: acc }));
                                            });
                                            allEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

                                            const combinedColumns = ["Date", "Phase", "Account Name", "Debit", "Credit", "Running Balance"].filter(c => config.selectedColumns.ledger.includes(c) || c === "Account Name");

                                            return (
                                                <div style={{ marginBottom: '1cm' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                                                        <thead><tr style={{ background: '#f8fafc' }}>{combinedColumns.map(c => <th key={c} style={{ border: '1px solid #000', padding: '8pt', textAlign: 'left' }}>{c}</th>)}</tr></thead>
                                                        <tbody>
                                                            {allEntries.map((e, eidx) => (
                                                                <tr key={eidx}>
                                                                    {combinedColumns.map(col => {
                                                                        let val = "-";
                                                                        if (col === "Date") val = e.date ? formatDate(e.date) : '-';
                                                                        if (col === "Phase") val = e.phaseName || 'Project';
                                                                        if (col === "Account Name") val = e.accountName;
                                                                        if (col === "Debit") val = e.type === 'DEBIT' ? formatCurrency(e.amount) : '-';
                                                                        if (col === "Credit") val = e.type === 'CREDIT' ? formatCurrency(e.amount) : '-';
                                                                        if (col === "Running Balance") val = `${formatCurrency(Math.abs(e.runningBalance))} ${getDrCr(e.runningBalance, e.accountType)}`;
                                                                        return <td key={col} style={{ border: '1px solid #000', padding: '8pt' }}>{val}</td>;
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })() : Object.entries(ledgerData).map(([acc, entries], idx) => (
                                            <div key={acc} style={{ marginBottom: '1cm' }}>
                                                <h3 style={{ fontSize: '14pt', fontWeight: 800, marginBottom: '0.4cm', color: '#334155' }}>ACCOUNT: {acc}</h3>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                                                    <thead><tr style={{ background: '#f8fafc' }}>{(config.selectedColumns.ledger || []).map(c => <th key={c} style={{ border: '1px solid #000', padding: '8pt', textAlign: 'left' }}>{c}</th>)}</tr></thead>
                                                    <tbody>
                                                        {entries.map((e, eidx) => (
                                                            <tr key={eidx}>
                                                                {config.selectedColumns.ledger.map(col => {
                                                                    let val = "-";
                                                                    if (col === "Date") val = e.date ? new Date(e.date).toLocaleDateString('en-GB') : '-';
                                                                    if (col === "Phase") val = e.phaseName || 'Project';
                                                                    if (col === "Debit") val = e.type === 'DEBIT' ? formatCurrency(e.amount) : '-';
                                                                    if (col === "Credit") val = e.type === 'CREDIT' ? formatCurrency(e.amount) : '-';
                                                                    if (col === "Running Balance") val = `${formatCurrency(Math.abs(e.runningBalance))} ${getDrCr(e.runningBalance, e.accountType)}`;
                                                                    return <td key={col} style={{ border: '1px solid #000', padding: '8pt' }}>{val}</td>;
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {settings.reportSections.trialBalance && trialBalanceData && (
                                    <div style={{ marginBottom: '1cm' }}>
                                        <h2 style={{ fontSize: '18pt', fontWeight: 800, borderBottom: '2.5pt solid #000', paddingBottom: '0.1cm', marginBottom: '0.6cm' }}>{getHeadingParams()}TRIAL BALANCE</h2>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                                            <thead><tr style={{ background: '#f8fafc' }}>{(config.selectedColumns.trialBalance || []).map(c => <th key={c} style={{ border: '1px solid #000', padding: '8pt', textAlign: 'left' }}>{c}</th>)}</tr></thead>
                                            <tbody>
                                                {Object.values(trialBalanceData.accounts).map(acc => (
                                                    <tr key={acc.name}>
                                                        {config.selectedColumns.trialBalance.map(col => {
                                                            let val = "-";
                                                            const balanceVal = parseFloat(acc.balance);
                                                            if (col === "Account Name") val = acc.name;
                                                            if (col === "Debit Balance") val = balanceVal > 0 ? formatCurrency(balanceVal) : '0.00';
                                                            if (col === "Credit Balance") val = balanceVal < 0 ? formatCurrency(Math.abs(balanceVal)) : '0.00';
                                                            return <td key={col} style={{ border: '1px solid #000', padding: '8pt' }}>{val}</td>;
                                                        })}
                                                    </tr>
                                                ))}
                                                <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                                                    {config.selectedColumns.trialBalance.map(col => {
                                                        let val = "";
                                                        if (col === "Account Name") val = "TOTAL";
                                                        if (col === "Debit Balance") val = formatCurrency(trialBalanceData.totals.totalDebits);
                                                        if (col === "Credit Balance") val = formatCurrency(trialBalanceData.totals.totalCredits);
                                                        return <td key={col} style={{ border: '1px solid #000', padding: '8pt' }}>{val}</td>;
                                                    })}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
