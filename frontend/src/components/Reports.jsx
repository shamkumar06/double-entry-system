import React, { useState, useEffect, useRef } from 'react';
import { Download, Plus, Trash2, Check, Settings as SettingsIcon, Calendar, Type, Layout, Activity, Layers, ChevronDown, Edit3 } from 'lucide-react';
import { useSettings, useFormatting } from '../context/SettingsContext';
import { accountingApi } from '../services/api';
import { parseDescription } from '../utils/descriptionParser';

const STUDIO_STYLES = `
    .report-studio-container {
        display: flex;
        height: calc(100vh - 120px);
        overflow: hidden;
        border-radius: 16px;
        background: var(--background);
        border: 1px solid var(--border);
    }
    .report-studio-controls {
        width: 380px;
        min-width: 380px;
        display: flex;
        flex-direction: column;
        border-right: 1px solid var(--border);
        background: var(--surface);
        z-index: 10;
        height: 100%;
    }
    .report-preview-pane {
        flex: 1;
        overflow-y: auto;
        padding: 2rem 2rem 4rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #e5e9f0;
        height: 100%;
        gap: 0;
    }
    .studio-section {
        background: var(--surface);
        border-radius: 12px;
        padding: 0.5rem 0;
        transition: all 0.2s;
    }
    .report-page-a4 {
        width: 210mm;
        height: 297mm;
        position: relative;
        overflow: hidden;
        background: white;
        box-shadow: 0 4px 24px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10);
        border: 1px solid #c8c8c8;
        flex-shrink: 0;
        margin-bottom: 16px;
    }
    .report-page-a4:first-of-type {
        margin-top: 0;
    }
    .report-page-num {
        position: absolute;
        bottom: 7mm;
        right: 18mm;
        font-size: 7pt;
        font-weight: 600;
        color: #94a3b8;
        font-family: 'Calibri', Arial, sans-serif;
        letter-spacing: 0.3px;
        z-index: 10;
    }
    .page-top-rule {
        position: absolute;
        top: 17mm;
        left: 18mm;
        right: 18mm;
        height: 1px;
        background: rgba(148,163,184,0.25);
        z-index: 5;
    }
    .page-bottom-rule {
        position: absolute;
        bottom: 15mm;
        left: 18mm;
        right: 18mm;
        height: 1px;
        background: rgba(148,163,184,0.25);
        z-index: 5;
    }
    .studio-card {
        background: var(--background);
        border: 1px solid var(--border);
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
        background: var(--surface);
    }
`;

export default function Reports({ projectId, projectName, phasesList }) {
    const { settings, updateSettings } = useSettings();
    const { formatCurrency } = useFormatting();
    const config = {
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
        ledgerAccounts: [],
        ...(settings.reportConfig || {}),
        selectedColumns: {
            journal: ["Date", "Phase", "Category", "Description", "Amount"],
            ledger: ["Date", "Phase", "Debit", "Credit", "Running Balance"],
            trialBalance: ["Account Name", "Debit Balance", "Credit Balance"],
            ...(settings.reportConfig?.selectedColumns || {})
        }
    };
    
    const [downloading, setDownloading] = useState(false);
    const [activeControlTab, setActiveControlTab] = useState('branding'); // 'branding', 'filters', 'columns'
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
    const [previewPages, setPreviewPages] = useState(1);
    const measureRef = useRef(null);

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

    // Pagination: measure hidden content div and compute page count
    const CONTENT_H_PER_PAGE_MM = 257; // 297mm A4 - 20mm top - 20mm bottom margin
    const PAGE_SIDE_MARGIN_MM = 18;    // left/right margin in mm
    const PAGE_TOP_MARGIN_MM  = 20;    // top margin per page in mm

    useEffect(() => {
        if (!measureRef.current) return;
        const recalc = () => {
            if (!measureRef.current) return;
            const totalPx = measureRef.current.scrollHeight;
            // 1mm = 96/25.4 px at standard screen DPI
            const perPagePx = CONTENT_H_PER_PAGE_MM * (96 / 25.4);
            setPreviewPages(Math.max(1, Math.ceil(totalPx / perPagePx)));
        };
        const obs = new ResizeObserver(recalc);
        obs.observe(measureRef.current);
        recalc();
        return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [journalData, ledgerData, trialBalanceData, settings.reportSections, config]);

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

    // ── renderPreviewContent: returns full report JSX used in both hidden measure div and A4 pages ──
    const renderPreviewContent = () => {
        let sec = 1;
        const romans = ['I','II','III','IV','V','VI','VII'];
        const headingNum = () => {
            const n = config.useRomanNumerals !== false ? (romans[sec - 1] || sec) : sec;
            sec++;
            return `${n}. `;
        };
        const getDrCr = (amt, type) => {
            const v = parseFloat(amt);
            const isNormalDebit = ['ASSET','EXPENSE'].includes(type);
            if (isNormalDebit) return v >= 0 ? 'Dr' : 'Cr';
            return v >= 0 ? 'Cr' : 'Dr';
        };

        return (
            <>
                {/* ── Date corner ── */}
                {config.showDateCorner && (
                    <div style={{ textAlign: 'right', fontSize: '8pt', color: '#64748b', marginBottom: '4mm' }}>
                        {config.reportDate
                            ? new Date(config.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                )}

                {/* ── Title block ── */}
                <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
                    <div style={{ fontSize: `${config.headerFontSize || 26}pt`, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.1 }}>
                        {config.customHeader || projectName}
                    </div>
                    {config.showTitleLine && (
                        <div style={{ height: '2px', background: '#1e293b', margin: '3mm 0 2mm' }} />
                    )}
                    {(config.subHeaders || []).map((sh, idx) => (
                        <div key={idx} style={{ fontSize: `${sh.fontSize || 12}pt`, fontStyle: 'italic', color: '#475569', marginTop: '1mm' }}>
                            {sh.text}
                        </div>
                    ))}
                </div>

                {/* ── Section divider ── */}
                <div style={{ height: '1px', background: '#334155', marginBottom: '6mm' }} />

                {/* ── JOURNAL ENTRIES ── */}
                {settings.reportSections.journal && (
                    <div style={{ marginBottom: '7mm' }}>
                        <div style={{ fontSize: '11pt', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', borderBottom: '1.5pt solid #1e293b', paddingBottom: '1.5mm', marginBottom: '3mm' }}>
                            {headingNum()}Journal Entries
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    {(config.selectedColumns.journal || []).map(c => (
                                        <th key={c} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: c === 'Amount' ? 'right' : 'left', fontWeight: 700, color: '#000' }}>{c}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {journalData.length > 0 ? journalData.map((tx, idx) => {
                                    const primaryAccount = tx.lines?.find(l => l.type === 'DEBIT')?.account?.name || '-';
                                    const txAmount = tx.lines?.[0]?.amount || 0;
                                    let pureDesc = tx.description || '-';
                                    let fromName = tx.fromEntity || '-';
                                    let toName = tx.toEntity || '-';
                                    if (tx.description?.includes('| From:')) {
                                        const parts = tx.description.split('|');
                                        pureDesc = parts[0]?.trim() || '-';
                                        const m = parts[1]?.match(/From: (.*?) To: (.*)/);
                                        if (m) { fromName = m[1]?.trim() || fromName; toName = m[2]?.trim() || toName; }
                                    }
                                    return (
                                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            {config.selectedColumns.journal.map(col => {
                                                let val = '-';
                                                if (col === 'Date') val = tx.date ? formatDate(tx.date) : '-';
                                                if (col === 'Amount') val = formatCurrency(txAmount);
                                                if (col === 'Phase') val = tx.phase?.name || 'Project';
                                                if (col === 'Category') val = primaryAccount;
                                                if (col === 'Description') val = pureDesc;
                                                if (col === 'From') val = fromName;
                                                if (col === 'To') val = toName;
                                                return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: col === 'Amount' ? 'right' : 'left', color: '#000' }}>{val}</td>;
                                            })}
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={(config.selectedColumns.journal || []).length} style={{ border: '0.5pt solid #000', padding: '10pt', textAlign: 'center', fontStyle: 'italic', color: '#64748b' }}>
                                        No data — select a phase or date range.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── GENERAL LEDGER ── */}
                {settings.reportSections.ledger && (
                    <div style={{ marginBottom: '7mm' }}>
                        <div style={{ fontSize: '11pt', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', borderBottom: '1.5pt solid #1e293b', paddingBottom: '1.5mm', marginBottom: '3mm' }}>
                            {headingNum()}General Ledger
                        </div>
                        {config.combineLedgerAccounts ? (() => {
                            const all = [];
                            Object.entries(ledgerData).forEach(([acc, entries]) => entries.forEach(e => all.push({ ...e, accountName: acc })));
                            all.sort((a, b) => new Date(a.date) - new Date(b.date));
                            const cols = ['Date','Phase','Account Name','Debit','Credit','Running Balance'].filter(c => config.selectedColumns.ledger.includes(c) || c === 'Account Name');
                            return (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
                                    <thead><tr style={{ background: '#f1f5f9' }}>{cols.map(c => <th key={c} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: ['Debit','Credit','Running Balance'].includes(c) ? 'right' : 'left', fontWeight: 700, color: '#000' }}>{c}</th>)}</tr></thead>
                                    <tbody>{all.map((e, i) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            {cols.map(col => {
                                                const isR = ['Debit','Credit','Running Balance'].includes(col);
                                                let val = '-';
                                                if (col === 'Date') val = e.date ? formatDate(e.date) : '-';
                                                if (col === 'Phase') val = e.phaseName || 'Project';
                                                if (col === 'Account Name') val = e.accountName;
                                                if (col === 'Debit') val = e.type === 'DEBIT' ? formatCurrency(e.amount) : '-';
                                                if (col === 'Credit') val = e.type === 'CREDIT' ? formatCurrency(e.amount) : '-';
                                                if (col === 'Running Balance') val = `${formatCurrency(Math.abs(e.runningBalance))} ${getDrCr(e.runningBalance, e.accountType)}`;
                                                return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: isR ? 'right' : 'left', color: '#000' }}>{val}</td>;
                                            })}
                                        </tr>
                                    ))}</tbody>
                                </table>
                            );
                        })() : Object.entries(ledgerData).map(([acc, entries]) => (
                            <div key={acc} style={{ marginBottom: '5mm' }}>
                                <div style={{ fontSize: '9.5pt', fontWeight: 800, color: '#0f172a', marginBottom: '2mm' }}>ACCOUNT: {acc}</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
                                    <thead><tr style={{ background: '#f1f5f9' }}>{(config.selectedColumns.ledger || []).map(c => <th key={c} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: ['Debit','Credit','Running Balance'].includes(c) ? 'right' : 'left', fontWeight: 700, color: '#000' }}>{c}</th>)}</tr></thead>
                                    <tbody>{entries.map((e, i) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            {config.selectedColumns.ledger.map(col => {
                                                const isR = ['Debit','Credit','Running Balance'].includes(col);
                                                let val = '-';
                                                if (col === 'Date') val = e.date ? formatDate(e.date) : '-';
                                                if (col === 'Phase') val = e.phaseName || 'Project';
                                                if (col === 'Debit') val = e.type === 'DEBIT' ? formatCurrency(e.amount) : '-';
                                                if (col === 'Credit') val = e.type === 'CREDIT' ? formatCurrency(e.amount) : '-';
                                                if (col === 'Running Balance') val = `${formatCurrency(Math.abs(e.runningBalance))} ${getDrCr(e.runningBalance, e.accountType)}`;
                                                return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: isR ? 'right' : 'left', color: '#000' }}>{val}</td>;
                                            })}
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── TRIAL BALANCE ── */}
                {settings.reportSections.trialBalance && trialBalanceData && (
                    <div style={{ marginBottom: '7mm' }}>
                        <div style={{ fontSize: '11pt', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', borderBottom: '1.5pt solid #1e293b', paddingBottom: '1.5mm', marginBottom: '3mm' }}>
                            {headingNum()}Trial Balance
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    {(config.selectedColumns.trialBalance || []).map(c => (
                                        <th key={c} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: c === 'Account Name' ? 'left' : 'right', fontWeight: 700, color: '#000' }}>{c}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Object.values(trialBalanceData.accounts || {}).map((acc, i) => (
                                    <tr key={acc.name || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                        {config.selectedColumns.trialBalance.map(col => {
                                            const bal = parseFloat(acc.balance || 0);
                                            let val = '-';
                                            if (col === 'Account Name') val = acc.name || 'Unknown';
                                            if (col === 'Debit Balance') val = bal > 0 ? formatCurrency(bal) : '0.00';
                                            if (col === 'Credit Balance') val = bal < 0 ? formatCurrency(Math.abs(bal)) : '0.00';
                                            return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: col === 'Account Name' ? 'left' : 'right', color: '#000' }}>{val}</td>;
                                        })}
                                    </tr>
                                ))}
                                <tr style={{ background: '#e2e8f0' }}>
                                    {config.selectedColumns.trialBalance.map(col => {
                                        let val = '';
                                        if (col === 'Account Name') val = 'TOTAL';
                                        if (col === 'Debit Balance') val = formatCurrency(trialBalanceData.totals?.totalDebits || 0);
                                        if (col === 'Credit Balance') val = formatCurrency(trialBalanceData.totals?.totalCredits || 0);
                                        return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: col === 'Account Name' ? 'left' : 'right', fontWeight: 800, color: '#000' }}>{val}</td>;
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="report-studio-container">
            <style>{STUDIO_STYLES}</style>
            
            {/* LEFT SIDE: STUDIO CONTROLS */}
            <div className="report-studio-controls">
                {/* STUDIO HEADER */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ background: 'var(--primary)', color: 'var(--btn-primary-text)', padding: '0.5rem', borderRadius: '10px' }}>
                                <SettingsIcon size={18} />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.2 }}>Report Studio</h3>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>IDENTITY POWERED • V2.0</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.25rem 0.65rem', borderRadius: '20px' }}>
                            <div style={{ width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--success)', letterSpacing: '0.5px' }}>LIVE</span>
                        </div>
                    </div>
                    
                    {/* Primary Download Button */}
                    <button 
                        onClick={handleDownload} 
                        disabled={downloading} 
                        className="btn-primary" 
                        style={{ 
                            width: '100%', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem', 
                            padding: '0.8rem', 
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            boxShadow: '0 4px 12px var(--btn-primary-shadow)'
                        }}
                    >
                        {downloading ? 'Drafting Report...' : <><Download size={18} /> Download Word Doc</>}
                    </button>

                    {/* Premium Horizontal Navigation Tabs */}
                    <div style={{ 
                        display: 'flex', 
                        background: 'var(--background)', 
                        padding: '0.25rem', 
                        borderRadius: '10px', 
                        marginTop: '1.25rem',
                        border: '1px solid var(--border)'
                    }}>
                        {[
                            { id: 'branding', label: 'Style', icon: <Type size={14} /> },
                            { id: 'filters', label: 'Filters', icon: <Calendar size={14} /> },
                            { id: 'columns', label: 'Columns', icon: <Layout size={14} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveControlTab(tab.id)}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.35rem',
                                    padding: '0.5rem 0.25rem',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: activeControlTab === tab.id ? 700 : 500,
                                    background: activeControlTab === tab.id ? 'var(--surface)' : 'transparent',
                                    color: activeControlTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                    boxShadow: activeControlTab === tab.id ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* TAB 1: STYLE & BRANDING */}
                    {activeControlTab === 'branding' && (
                        <>
                            <div className="studio-section">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block', letterSpacing: '0.5px' }}>Document Title</label>
                                <div className="studio-card">
                                    <input 
                                        type="text" 
                                        value={config.customHeader} 
                                        onChange={e => updateConfig({ customHeader: e.target.value })} 
                                        placeholder="Main Report Title..." 
                                        style={{ 
                                            width: '100%', 
                                            padding: '0.75rem', 
                                            borderRadius: '10px', 
                                            border: '1px solid var(--border)', 
                                            background: 'var(--background)', 
                                            color: 'var(--text-main)', 
                                            fontWeight: 700, 
                                            fontSize: '0.95rem', 
                                            marginBottom: '1rem',
                                            outline: 'none'
                                        }} 
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Font Size</span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>{config.headerFontSize || 26}pt</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="14" 
                                        max="42" 
                                        value={config.headerFontSize || 26} 
                                        onChange={e => updateConfig({ headerFontSize: parseInt(e.target.value) })} 
                                        style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', marginBottom: '1rem' }} 
                                    />
                                    
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={config.showTitleLine} 
                                            onChange={e => updateConfig({ showTitleLine: e.target.checked })} 
                                            style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
                                        />
                                        Show divider line below title
                                    </label>
                                </div>
                            </div>

                            <div className="studio-section">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                     <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sub-headings</label>
                                     <button 
                                        onClick={() => updateConfig({ subHeaders: [...(config.subHeaders || []), { text: "", fontSize: 12 }] })} 
                                        style={{ color: 'var(--primary)', background: 'none', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                     >
                                        <Plus size={14} /> Add Line
                                     </button>
                                </div>
                                
                                {(config.subHeaders || []).length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                        No sub-headings added yet. Click "+ Add Line" above.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {(config.subHeaders || []).map((sh, idx) => (
                                            <div key={idx} className="studio-card" style={{ padding: '0.85rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <input 
                                                        type="text" 
                                                        value={sh.text} 
                                                        onChange={e => handleUpdateSubHeader(idx, 'text', e.target.value)} 
                                                        placeholder="Sub-heading text..." 
                                                        style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid var(--border)', outline: 'none' }} 
                                                    />
                                                    <button onClick={() => updateConfig({ subHeaders: config.subHeaders.filter((_, i) => i !== idx) })} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <input type="range" min="8" max="20" value={sh.fontSize || 12} onChange={e => handleUpdateSubHeader(idx, 'fontSize', parseInt(e.target.value))} style={{ flex: 1, height: '4px', cursor: 'pointer' }} />
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '24px', textAlign: 'right' }}>{sh.fontSize || 12}pt</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="studio-section">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block', letterSpacing: '0.5px' }}>Date Corner</label>
                                <div className="studio-card">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: config.showDateCorner ? '0.75rem' : 0 }}>
                                        <input 
                                            type="checkbox" 
                                            checked={config.showDateCorner} 
                                            onChange={e => updateConfig({ showDateCorner: e.target.checked })} 
                                            style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
                                        />
                                        Show Date in Top-Right Corner
                                    </label>
                                    {config.showDateCorner && (
                                        <input 
                                            type="date" 
                                            value={config.reportDate} 
                                            onChange={e => updateConfig({ reportDate: e.target.value })} 
                                            style={{ 
                                                width: '100%', 
                                                padding: '0.5rem', 
                                                borderRadius: '8px', 
                                                border: '1px solid var(--border)', 
                                                background: 'var(--background)', 
                                                color: 'var(--text-main)', 
                                                fontSize: '0.8rem',
                                                outline: 'none'
                                            }} 
                                        />
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* TAB 2: DATA & FILTERS */}
                    {activeControlTab === 'filters' && (
                        <>
                            <div className="studio-section">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block', letterSpacing: '0.5px' }}>Date Filtering</label>
                                <div className="studio-card">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Start Date</span>
                                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none' }} />
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>End Date</span>
                                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-main)', fontSize: '0.8rem', outline: 'none' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="studio-section">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block', letterSpacing: '0.5px' }}>Filter by Phase</label>
                                <div className="studio-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', padding: '0.75rem' }}>
                                    <button 
                                        onClick={() => setSelectedPhaseIds([])} 
                                        style={{ 
                                            width: '100%', 
                                            textAlign: 'left', 
                                            padding: '0.5rem 0.75rem', 
                                            borderRadius: '8px', 
                                            border: 'none', 
                                            background: selectedPhaseIds.length === 0 ? 'var(--primary)' : 'var(--background)', 
                                            color: selectedPhaseIds.length === 0 ? 'var(--btn-primary-text)' : 'var(--text-main)', 
                                            fontSize: '0.8rem', 
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        Whole Project
                                    </button>
                                    {localPhases.map(ph => (
                                        <button 
                                            key={ph.id} 
                                            onClick={(e) => e.shiftKey ? setSelectedPhaseIds(p => p.includes(ph.id) ? p.filter(id => id !== ph.id) : [...p, ph.id]) : setSelectedPhaseIds([ph.id]) } 
                                            style={{ 
                                                width: '100%', 
                                                textAlign: 'left', 
                                                padding: '0.5rem 0.75rem', 
                                                borderRadius: '8px', 
                                                border: 'none', 
                                                background: selectedPhaseIds.includes(ph.id) ? 'var(--secondary)' : 'var(--background)', 
                                                color: selectedPhaseIds.includes(ph.id) ? 'white' : 'var(--text-muted)', 
                                                fontSize: '0.8rem', 
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                            title="Shift + Click to select multiple phases"
                                        >
                                            {ph.name}
                                        </button>
                                    ))}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem', fontStyle: 'italic' }}>* Shift + Click to select multiple phases.</span>
                            </div>

                            <div className="studio-section">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block', letterSpacing: '0.5px' }}>Global Settings</label>
                                <div className="studio-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={config.useRomanNumerals !== false} 
                                            onChange={() => updateConfig({ useRomanNumerals: !config.useRomanNumerals })} 
                                            style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
                                        />
                                        Use Roman Numeral Headings
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={config.combineLedgerAccounts} 
                                            onChange={() => updateConfig({ combineLedgerAccounts: !config.combineLedgerAccounts })} 
                                            style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
                                        />
                                        Combine Ledger in 1 Table
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={config.showFooterNote} 
                                            onChange={() => updateConfig({ showFooterNote: !config.showFooterNote })} 
                                            style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
                                        />
                                        Show Footer Note
                                    </label>
                                    {config.showFooterNote && (
                                        <input 
                                            type="text" 
                                            value={config.footerNote} 
                                            onChange={e => updateConfig({ footerNote: e.target.value })} 
                                            placeholder="Footer text..." 
                                            style={{ 
                                                width: '100%', 
                                                padding: '0.5rem', 
                                                borderRadius: '8px', 
                                                border: '1px solid var(--border)', 
                                                background: 'var(--background)', 
                                                color: 'var(--text-main)', 
                                                fontSize: '0.8rem',
                                                outline: 'none'
                                            }} 
                                        />
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* TAB 3: TABLE COLUMNS */}
                    {activeControlTab === 'columns' && (
                        <>
                            <div className="studio-section">
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'block', letterSpacing: '0.5px' }}>Include Sections & Columns</label>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {/* JOURNAL CARD */}
                                    <div className="studio-card" style={{ padding: '1rem', borderLeft: settings.reportSections.journal ? '4px solid var(--primary)' : '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSettings({ reportSections: { ...settings.reportSections, journal: !settings.reportSections.journal } })}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <input type="checkbox" checked={settings.reportSections.journal} readOnly style={{ accentColor: 'var(--primary)' }} />
                                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>I. Journal Entries</span>
                                            </div>
                                            <ChevronDown size={16} style={{ transform: expandedSections.journal ? 'rotate(180deg)' : '', transition: '0.2s', color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); setExpandedSections(p => ({ ...p, journal: !p.journal })) }} />
                                        </div>
                                        {expandedSections.journal && settings.reportSections.journal && (
                                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>VISIBLE COLUMNS</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                    {["Date", "Phase", "From", "To", "Category", "Description", "Amount"].map(col => {
                                                        const isSelected = config.selectedColumns.journal.includes(col);
                                                        return (
                                                            <button 
                                                                key={col} 
                                                                onClick={() => toggleColumn('journal', col)} 
                                                                style={{ 
                                                                    fontSize: '0.65rem', 
                                                                    padding: '0.3rem 0.55rem', 
                                                                    borderRadius: '6px', 
                                                                    cursor: 'pointer', 
                                                                    background: isSelected ? 'var(--primary)' : 'var(--background)', 
                                                                    color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-muted)', 
                                                                    border: '1px solid ' + (isSelected ? 'var(--primary)' : 'var(--border)'),
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {col}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* LEDGER CARD */}
                                    <div className="studio-card" style={{ padding: '1rem', borderLeft: settings.reportSections.ledger ? '4px solid var(--primary)' : '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSettings({ reportSections: { ...settings.reportSections, ledger: !settings.reportSections.ledger } })}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <input type="checkbox" checked={settings.reportSections.ledger} readOnly style={{ accentColor: 'var(--primary)' }} />
                                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>II. General Ledger</span>
                                            </div>
                                            <ChevronDown size={16} style={{ transform: expandedSections.ledger ? 'rotate(180deg)' : '', transition: '0.2s', color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); setExpandedSections(p => ({ ...p, ledger: !p.ledger })) }} />
                                        </div>
                                        {expandedSections.ledger && settings.reportSections.ledger && (
                                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>VISIBLE COLUMNS</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                                                    {["Date", "Phase", "Debit", "Credit", "Running Balance"].map(col => {
                                                        const isSelected = config.selectedColumns.ledger.includes(col);
                                                        return (
                                                            <button 
                                                                key={col} 
                                                                onClick={() => toggleColumn('ledger', col)} 
                                                                style={{ 
                                                                    fontSize: '0.65rem', 
                                                                    padding: '0.3rem 0.55rem', 
                                                                    borderRadius: '6px', 
                                                                    cursor: 'pointer',
                                                                    background: isSelected ? 'var(--primary)' : 'var(--background)', 
                                                                    color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-muted)', 
                                                                    border: '1px solid ' + (isSelected ? 'var(--primary)' : 'var(--border)'),
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {col}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>FILTER ACCOUNTS</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxHeight: '100px', overflowY: 'auto', background: 'var(--background)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                    {allAccounts.map(acc => {
                                                        const isSelected = config.ledgerAccounts.includes(acc.name);
                                                        return (
                                                            <button 
                                                                key={acc.id} 
                                                                onClick={() => updateConfig({ ledgerAccounts: isSelected ? config.ledgerAccounts.filter(a => a !== acc.name) : [...config.ledgerAccounts, acc.name] })} 
                                                                style={{ 
                                                                    fontSize: '0.6rem', 
                                                                    padding: '0.25rem 0.45rem', 
                                                                    borderRadius: '6px', 
                                                                    cursor: 'pointer',
                                                                    background: isSelected ? 'var(--primary)' : 'var(--surface)', 
                                                                    color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-muted)', 
                                                                    border: '1px solid var(--border)',
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {acc.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* TRIAL BALANCE CARD */}
                                    <div className="studio-card" style={{ padding: '1rem', borderLeft: settings.reportSections.trialBalance ? '4px solid var(--primary)' : '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => updateSettings({ reportSections: { ...settings.reportSections, trialBalance: !settings.reportSections.trialBalance } })}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <input type="checkbox" checked={settings.reportSections.trialBalance} readOnly style={{ accentColor: 'var(--primary)' }} />
                                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>III. Trial Balance</span>
                                            </div>
                                            <ChevronDown size={16} style={{ transform: expandedSections.tb ? 'rotate(180deg)' : '', transition: '0.2s', color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); setExpandedSections(p => ({ ...p, tb: !p.tb })) }} />
                                        </div>
                                        {expandedSections.tb && settings.reportSections.trialBalance && (
                                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>VISIBLE COLUMNS</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                    {["Account Name", "Debit Balance", "Credit Balance"].map(col => {
                                                        const isSelected = config.selectedColumns.trialBalance.includes(col);
                                                        return (
                                                            <button 
                                                                key={col} 
                                                                onClick={() => toggleColumn('trialBalance', col)} 
                                                                style={{ 
                                                                    fontSize: '0.65rem', 
                                                                    padding: '0.3rem 0.55rem', 
                                                                    borderRadius: '6px', 
                                                                    cursor: 'pointer',
                                                                    background: isSelected ? 'var(--primary)' : 'var(--background)', 
                                                                    color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-muted)', 
                                                                    border: '1px solid ' + (isSelected ? 'var(--primary)' : 'var(--border)'),
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {col}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </div>
            {/* RIGHT SIDE: LIVE PREVIEW — paginated A4 */}
            <div className="report-preview-pane">

                {/* ── Hidden measurement div: same width as content area ── */}
                <div style={{
                    position: 'fixed', left: '-9999px', top: 0,
                    width: `${210 - 2 * PAGE_SIDE_MARGIN_MM}mm`,
                    overflow: 'visible', visibility: 'hidden',
                    pointerEvents: 'none', zIndex: -1,
                    fontFamily: 'Calibri, Arial, sans-serif',
                    fontSize: '9.5pt', lineHeight: 1.4, color: '#000',
                }}>
                    <div ref={measureRef}>
                        {renderPreviewContent()}
                    </div>
                </div>

                {/* ── A4 page cards ── */}
                {Array.from({ length: previewPages }, (_, pageIdx) => (
                    <div key={pageIdx} className="report-page-a4">
                        {/* subtle margin guide lines */}
                        <div className="page-top-rule" />
                        <div className="page-bottom-rule" />

                        {/* page number */}
                        <span className="report-page-num">
                            {previewPages > 1
                                ? `Page ${pageIdx + 1} / ${previewPages}`
                                : 'LIVE PREVIEW'}
                        </span>

                        {/* content window — shifted per page */}
                        <div style={{
                            position: 'absolute',
                            top: `${PAGE_TOP_MARGIN_MM - pageIdx * CONTENT_H_PER_PAGE_MM}mm`,
                            left: `${PAGE_SIDE_MARGIN_MM}mm`,
                            width: `${210 - 2 * PAGE_SIDE_MARGIN_MM}mm`,
                            fontFamily: 'Calibri, Arial, sans-serif',
                            fontSize: '9.5pt',
                            lineHeight: 1.4,
                            color: '#000',
                        }}>
                            {renderPreviewContent()}
                        </div>
                    </div>
                ))}

            </div>
        </div>
    );
}
