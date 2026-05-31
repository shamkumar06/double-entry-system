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

    const CONTENT_H_PER_PAGE_MM = 257;
    
    const getDrCr = (amt, type) => {
        const v = parseFloat(amt);
        const isNormalDebit = ['ASSET','EXPENSE'].includes(type);
        if (isNormalDebit) return v >= 0 ? 'Dr' : 'Cr';
        return v >= 0 ? 'Cr' : 'Dr';
    };

    const generateLayoutItems = () => {
        const items = [];
        items.push({ id: 'title-block', type: 'title-block' });
        if (settings.reportSections.journal) {
            items.push({ id: 'journal-heading', type: 'section-heading', title: 'Journal Entries' });
            items.push({ id: 'journal-table-header', type: 'table-header', section: 'journal' });
            if (journalData.length > 0) {
                journalData.forEach((tx, idx) => { items.push({ id: `journal-row-${idx}`, type: 'journal-row', tx, idx }); });
            } else {
                items.push({ id: 'journal-empty', type: 'journal-empty' });
            }
        }
        if (settings.reportSections.ledger) {
            items.push({ id: 'ledger-heading', type: 'section-heading', title: 'General Ledger' });
            if (config.combineLedgerAccounts) {
                items.push({ id: 'ledger-combined-table-header', type: 'table-header', section: 'ledger-combined' });
                const allEntries = [];
                Object.entries(ledgerData).forEach(([acc, entries]) => entries.forEach(e => allEntries.push({ ...e, accountName: acc })));
                allEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
                allEntries.forEach((entry, idx) => { items.push({ id: `ledger-combined-row-${idx}`, type: 'ledger-combined-row', entry, idx }); });
            } else {
                Object.entries(ledgerData).forEach(([accName, entries]) => {
                    items.push({ id: `ledger-sep-heading-${accName}`, type: 'ledger-sep-heading', accName });
                    items.push({ id: `ledger-sep-table-header-${accName}`, type: 'table-header', section: 'ledger-sep', accName });
                    entries.forEach((entry, idx) => { items.push({ id: `ledger-sep-row-${accName}-${idx}`, type: 'ledger-sep-row', entry, idx, accName }); });
                });
            }
        }
        if (settings.reportSections.trialBalance && trialBalanceData) {
            items.push({ id: 'tb-heading', type: 'section-heading', title: 'Trial Balance' });
            items.push({ id: 'tb-table-header', type: 'table-header', section: 'tb' });
            const tbAccounts = Array.isArray(trialBalanceData.accounts) ? trialBalanceData.accounts : Object.values(trialBalanceData.accounts || {});
            tbAccounts.forEach((acc, idx) => { items.push({ id: `tb-row-${idx}`, type: 'tb-row', acc, idx }); });
            items.push({ id: 'tb-totals-row', type: 'tb-totals-row' });
        }
        if (config.showFooterNote && config.footerNote) items.push({ id: 'footer-note', type: 'footer-note' });
        return items;
    };

    const groupPageItems = (pageItems) => {
        const groups = [];
        let currentGroup = null;
        pageItems.forEach(item => {
            if (item.type === 'journal-row' || item.type === 'journal-empty') {
                if (currentGroup && currentGroup.type === 'journal-table') currentGroup.rows.push(item);
                else { if (currentGroup) groups.push(currentGroup); currentGroup = { type: 'journal-table', rows: [item] }; }
            } else if (item.type === 'ledger-combined-row') {
                if (currentGroup && currentGroup.type === 'ledger-combined-table') currentGroup.rows.push(item);
                else { if (currentGroup) groups.push(currentGroup); currentGroup = { type: 'ledger-combined-table', rows: [item] }; }
            } else if (item.type === 'ledger-sep-row') {
                if (currentGroup && currentGroup.type === 'ledger-sep-table' && currentGroup.accName === item.accName) currentGroup.rows.push(item);
                else { if (currentGroup) groups.push(currentGroup); currentGroup = { type: 'ledger-sep-table', accName: item.accName, rows: [item] }; }
            } else if (item.type === 'tb-row' || item.type === 'tb-totals-row') {
                if (currentGroup && currentGroup.type === 'tb-table') currentGroup.rows.push(item);
                else { if (currentGroup) groups.push(currentGroup); currentGroup = { type: 'tb-table', rows: [item] }; }
            } else {
                if (currentGroup) { groups.push(currentGroup); currentGroup = null; }
                groups.push(item);
            }
        });
        if (currentGroup) groups.push(currentGroup);
        return groups;
    };

    const renderJournalTable = (rows, isDraft = false) => {
        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: isDraft ? '5mm' : 0 }}>
                <thead id={isDraft ? "journal-table-header" : undefined}>
                    <tr style={{ background: '#f1f5f9' }}>
                        {(config.selectedColumns.journal || []).map(c => (
                            <th key={c} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: c === 'Amount' ? 'right' : 'left', fontWeight: 700, color: '#000' }}>{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(item => {
                        if (item.type === 'journal-empty') {
                            return (
                                <tr key="empty" id={isDraft ? "journal-empty" : undefined}>
                                    <td colSpan={(config.selectedColumns.journal || []).length} style={{ border: '0.5pt solid #000', padding: '10pt', textAlign: 'center', fontStyle: 'italic', color: '#64748b' }}>
                                        No data — select a phase or date range.
                                    </td>
                                </tr>
                            );
                        }
                        const tx = item.tx, idx = item.idx;
                        const lines = tx.lines || [];
                        const primaryAccount = lines.find(l => l.type === 'DEBIT')?.account?.name || '-';
                        const txAmount = lines[0]?.amount || 0;
                        const { pureDesc, fromName, toName } = parseDescription(tx.description);
                        const resolvedFrom = fromName !== '-' ? fromName : (tx.fromEntity || '-');
                        const resolvedTo = toName !== '-' ? toName : (tx.toEntity || '-');
                        return (
                            <tr key={idx} id={isDraft ? `journal-row-${idx}` : undefined} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                {config.selectedColumns.journal.map(col => {
                                    let val = '-';
                                    if (col === 'Date') val = tx.date ? formatDate(tx.date) : '-';
                                    if (col === 'Amount') val = formatCurrency(txAmount);
                                    if (col === 'Phase') val = tx.phase?.name || 'Project';
                                    if (col === 'Category') val = primaryAccount;
                                    if (col === 'Description') val = pureDesc;
                                    if (col === 'From') val = resolvedFrom;
                                    if (col === 'To') val = resolvedTo;
                                    return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: col === 'Amount' ? 'right' : 'left', color: '#000' }}>{val}</td>;
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    const renderLedgerCombinedTable = (rows, isDraft = false) => {
        const cols = ['Date','Phase','Account Name','Debit','Credit','Running Balance'].filter(c => config.selectedColumns.ledger.includes(c) || c === 'Account Name');
        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: isDraft ? '5mm' : 0 }}>
                <thead id={isDraft ? "ledger-combined-table-header" : undefined}>
                    <tr style={{ background: '#f1f5f9' }}>
                        {cols.map(c => <th key={c} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: ['Debit','Credit','Running Balance'].includes(c) ? 'right' : 'left', fontWeight: 700, color: '#000' }}>{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(item => {
                        const e = item.entry, i = item.idx;
                        const balStr = `${formatCurrency(Math.abs(e.runningBalance))} ${getDrCr(e.runningBalance, e.accountType)}`;
                        return (
                            <tr key={i} id={isDraft ? `ledger-combined-row-${i}` : undefined} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                {cols.map(col => {
                                    const isRCol = ['Debit','Credit','Running Balance'].includes(col);
                                    let val = '-';
                                    if (col === 'Date') val = e.date ? formatDate(e.date) : '-';
                                    if (col === 'Phase') val = e.phaseName || 'Project';
                                    if (col === 'Account Name') val = e.accountName;
                                    if (col === 'Debit') val = e.type === 'DEBIT' ? formatCurrency(e.amount) : '-';
                                    if (col === 'Credit') val = e.type === 'CREDIT' ? formatCurrency(e.amount) : '-';
                                    if (col === 'Running Balance') val = balStr;
                                    return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: isRCol ? 'right' : 'left', color: '#000' }}>{val}</td>;
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    const renderLedgerSepTable = (accName, rows, isDraft = false) => {
        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: isDraft ? '5mm' : 0 }}>
                <thead id={isDraft ? `ledger-sep-table-header-${accName}` : undefined}>
                    <tr style={{ background: '#f1f5f9' }}>
                        {(config.selectedColumns.ledger || []).map(c => <th key={c} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: ['Debit','Credit','Running Balance'].includes(c) ? 'right' : 'left', fontWeight: 700, color: '#000' }}>{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(item => {
                        const e = item.entry, i = item.idx;
                        const balStr = `${formatCurrency(Math.abs(e.runningBalance))} ${getDrCr(e.runningBalance, e.accountType)}`;
                        return (
                            <tr key={i} id={isDraft ? `ledger-sep-row-${accName}-${i}` : undefined} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                {config.selectedColumns.ledger.map(col => {
                                    const isRCol = ['Debit','Credit','Running Balance'].includes(col);
                                    let val = '-';
                                    if (col === 'Date') val = e.date ? formatDate(e.date) : '-';
                                    if (col === 'Phase') val = e.phaseName || 'Project';
                                    if (col === 'Debit') val = e.type === 'DEBIT' ? formatCurrency(e.amount) : '-';
                                    if (col === 'Credit') val = e.type === 'CREDIT' ? formatCurrency(e.amount) : '-';
                                    if (col === 'Running Balance') val = balStr;
                                    return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: isRCol ? 'right' : 'left', color: '#000' }}>{val}</td>;
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    const renderTbTable = (rows, isDraft = false) => {
        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: isDraft ? '5mm' : 0 }}>
                <thead id={isDraft ? "tb-table-header" : undefined}>
                    <tr style={{ background: '#f1f5f9' }}>
                        {(config.selectedColumns.trialBalance || []).map(c => (
                            <th key={c} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: c === 'Account Name' ? 'left' : 'right', fontWeight: 700, color: '#000' }}>{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(item => {
                        if (item.type === 'tb-totals-row') {
                            return (
                                <tr key="totals" id={isDraft ? "tb-totals-row" : undefined} style={{ background: '#e2e8f0' }}>
                                    {config.selectedColumns.trialBalance.map(col => {
                                        let val = '';
                                        if (col === 'Account Name') val = 'TOTAL';
                                        if (col === 'Debit Balance') val = formatCurrency(trialBalanceData.totals?.totalDebits || 0);
                                        if (col === 'Credit Balance') val = formatCurrency(trialBalanceData.totals?.totalCredits || 0);
                                        return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: col === 'Account Name' ? 'left' : 'right', fontWeight: 800, color: '#000' }}>{val}</td>;
                                    })}
                                </tr>
                            );
                        }
                        const acc = item.acc, i = item.idx;
                        const bal = parseFloat(acc.balance || 0);
                        return (
                            <tr key={acc.name || i} id={isDraft ? `tb-row-${i}` : undefined} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                {config.selectedColumns.trialBalance.map(col => {
                                    let val = '-';
                                    if (col === 'Account Name') val = acc.name || 'Unknown';
                                    if (col === 'Debit Balance') val = bal > 0 ? formatCurrency(bal) : '0.00';
                                    if (col === 'Credit Balance') val = bal < 0 ? formatCurrency(Math.abs(bal)) : '0.00';
                                    return <td key={col} style={{ border: '0.5pt solid #000', padding: '3pt 4pt', textAlign: col === 'Account Name' ? 'left' : 'right', color: '#000' }}>{val}</td>;
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    const renderGroupedItems = (grouped, isDraft = false) => {
        return (
            <>
                {grouped.map((group, gIdx) => {
                    if (group.type === 'title-block') {
                        return (
                            <div key="title-block" id={isDraft ? "title-block" : undefined} style={{ paddingBottom: '6mm' }}>
                                {config.showDateCorner && (
                                    <div style={{ textAlign: 'right', fontSize: '8pt', color: '#64748b', marginBottom: '4mm' }}>
                                        {config.reportDate ? new Date(config.reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </div>
                                )}
                                <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
                                    <div style={{ fontSize: `${config.headerFontSize || 26}pt`, fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: 1.1 }}>{config.customHeader || projectName}</div>
                                    {config.showTitleLine && <div style={{ height: '2px', background: '#1e293b', margin: '3mm 0 2mm' }} />}
                                    {(config.subHeaders || []).map((sh, idx) => <div key={idx} style={{ fontSize: `${sh.fontSize || 12}pt`, fontStyle: 'italic', color: '#475569', marginTop: '1mm' }}>{sh.text}</div>)}
                                </div>
                                <div style={{ height: '1px', background: '#334155' }} />
                            </div>
                        );
                    }
                    if (group.type === 'section-heading') {
                        let numStr = "";
                        if (group.title.includes("Journal")) numStr = config.useRomanNumerals !== false ? "I. " : "1. ";
                        else if (group.title.includes("Ledger")) numStr = config.useRomanNumerals !== false ? "II. " : "2. ";
                        else if (group.title.includes("Trial")) numStr = config.useRomanNumerals !== false ? "III. " : "3. ";
                        return (
                            <div key={group.id} id={isDraft ? group.id : undefined} style={{ paddingTop: '4mm', paddingBottom: '3mm' }}>
                                <div style={{ fontSize: '14pt', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', borderBottom: '1pt solid #1e293b', paddingBottom: '1.5mm' }}>{numStr}{group.title}</div>
                            </div>
                        );
                    }
                    if (group.type === 'ledger-sep-heading') return <div key={group.id} id={isDraft ? group.id : undefined} style={{ paddingTop: '3mm', paddingBottom: '2mm' }}><div style={{ fontSize: '11pt', fontWeight: 800, color: '#0f172a' }}>ACCOUNT: {group.accName}</div></div>;
                    if (group.type === 'journal-table') return <React.Fragment key={gIdx}>{renderJournalTable(group.rows, isDraft)}</React.Fragment>;
                    if (group.type === 'ledger-combined-table') return <React.Fragment key={gIdx}>{renderLedgerCombinedTable(group.rows, isDraft)}</React.Fragment>;
                    if (group.type === 'ledger-sep-table') return <React.Fragment key={gIdx}>{renderLedgerSepTable(group.accName, group.rows, isDraft)}</React.Fragment>;
                    if (group.type === 'tb-table') return <React.Fragment key={gIdx}>{renderTbTable(group.rows, isDraft)}</React.Fragment>;
                    if (group.type === 'footer-note') return <div key="footer-note" id={isDraft ? "footer-note" : undefined} style={{ paddingTop: '7mm' }}><div style={{ borderTop: '0.5pt solid #000', paddingTop: '3mm', fontSize: '8pt', fontStyle: 'italic', color: '#64748b' }}>{config.footerNote}</div></div>;
                    return null;
                })}
            </>
        );
    };

    const partitionItemsIntoPages = (items, heights, limit) => {
        const pages = [[]];
        let currentPageHeight = 0;
        const hasTableType = (page, type, accName = null) => {
            return page.some(item => {
                if (item.type === type) {
                    if (type === 'ledger-sep-row') return item.accName === accName;
                    return true;
                }
                return false;
            });
        };
        items.forEach(item => {
            const h = heights[item.id] || 0;
            let addedHeight = h;
            let extraHeaderHeight = 0;
            if (item.type === 'journal-row') { if (!hasTableType(pages[pages.length - 1], 'journal-row')) extraHeaderHeight = heights['journal-table-header'] || 0; }
            else if (item.type === 'ledger-combined-row') { if (!hasTableType(pages[pages.length - 1], 'ledger-combined-row')) extraHeaderHeight = heights['ledger-combined-table-header'] || 0; }
            else if (item.type === 'ledger-sep-row') { if (!hasTableType(pages[pages.length - 1], 'ledger-sep-row', item.accName)) extraHeaderHeight = heights[`ledger-sep-table-header-${item.accName}`] || 0; }
            else if (item.type === 'tb-row' || item.type === 'tb-totals-row') { if (!hasTableType(pages[pages.length - 1], 'tb-row') && !hasTableType(pages[pages.length - 1], 'tb-totals-row')) extraHeaderHeight = heights['tb-table-header'] || 0; }
            addedHeight += extraHeaderHeight;
            if (currentPageHeight + addedHeight > limit && pages[pages.length - 1].length > 0) {
                pages.push([]);
                currentPageHeight = h;
                if (item.type === 'journal-row') currentPageHeight += (heights['journal-table-header'] || 0);
                else if (item.type === 'ledger-combined-row') currentPageHeight += (heights['ledger-combined-table-header'] || 0);
                else if (item.type === 'ledger-sep-row') currentPageHeight += (heights[`ledger-sep-table-header-${item.accName}`] || 0);
                else if (item.type === 'tb-row' || item.type === 'tb-totals-row') currentPageHeight += (heights['tb-table-header'] || 0);
                pages[pages.length - 1].push(item);
            } else {
                currentPageHeight += addedHeight;
                pages[pages.length - 1].push(item);
            }
        });
        return pages;
    };

    useEffect(() => {
        const runMeasurement = () => {
            const items = generateLayoutItems();
            if (items.length === 0) return;
            requestAnimationFrame(() => {
                const heights = {};
                items.forEach(item => { const el = document.getElementById(item.id); if (el) heights[item.id] = el.getBoundingClientRect().height; });
                const perPagePx = CONTENT_H_PER_PAGE_MM * (96 / 25.4);
                const partitioned = partitionItemsIntoPages(items, heights, perPagePx);
                setComputedPages(partitioned);
            });
        };
        runMeasurement();
    }, [journalData, ledgerData, trialBalanceData, settings.reportSections, config, allAccounts]);

    const updateConfig = (partial) => { updateSettings({ reportConfig: { ...config, ...partial } }); };
    const handleUpdateSubHeader = (i, field, val) => { const newSubs = [...(config.subHeaders || [])]; newSubs[i] = { ...newSubs[i], [field]: val }; updateConfig({ subHeaders: newSubs }); };
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
        } catch (e) { alert("Failed to generate report: " + e.message); } finally { setDownloading(false); }
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
                    <div>
                        {renderGroupedItems(groupPageItems(generateLayoutItems()), true)}
                    </div>
                </div>

                {/* ── A4 page cards ── */}
                {computedPages.map((pageItems, pageIdx) => (
                    <div key={pageIdx} className="report-page-a4">
                        {/* page number */}
                        <span className="report-page-num">
                            {computedPages.length > 1
                                ? `Page ${pageIdx + 1} / ${computedPages.length}`
                                : 'LIVE PREVIEW'}
                        </span>

                        {/* page content container */}
                        <div style={{
                            paddingTop: `${PAGE_TOP_MARGIN_MM}mm`,
                            paddingLeft: `${PAGE_SIDE_MARGIN_MM}mm`,
                            paddingRight: `${PAGE_SIDE_MARGIN_MM}mm`,
                            fontFamily: 'Calibri, Arial, sans-serif',
                            fontSize: '9.5pt',
                            lineHeight: 1.4,
                            color: '#000',
                            height: '100%',
                            boxSizing: 'border-box'
                        }}>
                            {renderGroupedItems(groupPageItems(pageItems), false)}
                        </div>
                    </div>
                ))}

            </div>
        </div>
    );
}
