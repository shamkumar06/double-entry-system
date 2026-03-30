import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { BookOpen } from 'lucide-react';
import { useFormatting } from '../context/SettingsContext';

export default function Ledger({ projectId, projectName, phaseId, phaseName, accountName, setAccountName }) {
    const { formatCurrency, formatDate, sortData, sortOrder } = useFormatting();
    const [entries, setEntries] = useState([]);
    const [availableAccounts, setAvailableAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [phases, setPhases] = useState([]);
    const [selectedPhaseId, setSelectedPhaseId] = useState(phaseId || null);

    useEffect(() => {
        // Load project phases using ID
        accountingApi.listProjects().then(projs => {
            const p = projs.find(pj => pj.logical_id === projectId);
            if (p && p.phases) {
                setPhases(Object.values(p.phases));
            }
        });

        accountingApi.listCategories().then(data => {
            // Include Cash/Bank if not in records but they are standard
            const standard = [
                { name: 'Cash', code: 1001, account_type: 'Asset' },
                { name: 'Bank', code: 1002, account_type: 'Asset' }
            ];
            const existingCodes = new Set(data.map(c => c.code));
            const neededStandard = standard.filter(c => !existingCodes.has(c.code));
            const all = [...neededStandard, ...data];
            setCategories(all);
            setAvailableAccounts(all);
            
            if (!accountName) {
                setAccountName('Cash');
            }
        }).catch(err => {
            console.error("Failed to load categories for ledger", err);
        });
    }, [projectId]);

    useEffect(() => {
        setSelectedPhaseId(phaseId || null);
    }, [phaseId]);

    const fetchLedgerPage = async () => {
        const found = categories.find(c => c.name === accountName);
        if (!found) return;
        
        setLoading(true);
        try {
            // API now takes PROJECT ID and ACCOUNT ID (Logical)
            const data = await accountingApi.getLedger(projectId, found.code, selectedPhaseId);
            setEntries(sortData(data));
        } catch (error) {
            console.error("Failed to fetch ledger page", error);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLedgerPage();
    }, [projectId, accountName, selectedPhaseId, categories]);

    const togglePhase = (pid, e) => {
        const strPid = String(pid);
        if (e && e.shiftKey) {
            setSelectedPhaseId(prev => {
                if (!prev) return strPid;
                const arr = prev.split(',');
                if (arr.includes(strPid)) {
                    const newArr = arr.filter(p => p !== strPid);
                    return newArr.length > 0 ? newArr.join(',') : null;
                }
                return [...arr, strPid].join(',');
            });
        } else {
            setSelectedPhaseId(prev => (String(prev) === strPid ? null : strPid));
        }
    };
    
    // Determine normal balance side for display coloring
    const foundCategory = categories.find(c => c.name === accountName);
    const accountType = foundCategory?.account_type || 'Asset';
    const normalBalance = ['Asset', 'Expense'].includes(accountType) ? 'Debit' : 'Credit';

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <BookOpen color="var(--primary)" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Ledger Pages</h3>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Jump to Page:</span>
                    <select 
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        style={{ width: '200px' }}
                    >
                        {availableAccounts.map(acc => (
                            <option key={acc.code} value={acc.name}>{acc.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ marginBottom: '1.5rem', color: 'var(--text-main)', fontSize: '1.5rem', textAlign: 'center' }}>
                        {accountName} Account
                    </h4>
                    
                    {loading ? (
                        <p style={{ color: 'var(--text-muted)' }}>Loading ledger page...</p>
                    ) : entries.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No entries found for {accountName}.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Date</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Phase</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>Debit</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>Credit</th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>Running Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '1rem' }}>{formatDate(entry.date)}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ fontSize: '0.75rem', background: 'var(--surface-hover)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                                    {entry.phase_name || 'Project'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: entry.entry_type === 'Debit' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                {entry.entry_type === 'Debit' ? formatCurrency(entry.amount) : '-'}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: entry.entry_type === 'Credit' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                {entry.entry_type === 'Credit' ? formatCurrency(entry.amount) : '-'}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: (entry.running_balance ?? 0) < 0 ? 'var(--danger)' : 'var(--text-main)' }}>
                                                {formatCurrency(entry.running_balance ?? 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div style={{ width: '120px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
                        Phase Filter
                    </span>
                    <button 
                        onClick={() => setSelectedPhaseId(null)}
                        style={{ 
                            padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer',
                            textAlign: 'center', fontWeight: !selectedPhaseId ? 600 : 400,
                            background: !selectedPhaseId ? 'var(--primary)' : 'var(--surface)',
                            color: !selectedPhaseId ? '#fff' : 'var(--text-main)',
                            border: '1px solid ' + (!selectedPhaseId ? 'var(--primary)' : 'var(--border)'),
                            transition: 'all 0.2s'
                        }}
                    >
                        Whole Project
                    </button>
                    {phases.map(ph => {
                        const isSelected = selectedPhaseId && selectedPhaseId.split(',').includes(String(ph.phase_id));
                        return (
                            <button 
                                key={ph.phase_id}
                                onClick={(e) => togglePhase(ph.phase_id, e)}
                                style={{ 
                                    padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer',
                                    textAlign: 'center', fontWeight: isSelected ? 600 : 400,
                                    background: isSelected ? 'var(--secondary)' : 'var(--surface)',
                                    color: isSelected ? '#fff' : 'var(--text-main)',
                                    border: '1px solid ' + (isSelected ? 'var(--secondary)' : 'var(--border)'),
                                    transition: 'all 0.2s'
                                }}
                            >
                                {ph.name}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}
