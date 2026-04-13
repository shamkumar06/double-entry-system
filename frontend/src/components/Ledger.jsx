import React, { useState, useEffect, useMemo } from 'react';
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
        accountingApi.listPhases(projectId).then(phMap => {
            setPhases(Array.isArray(phMap) ? phMap : Object.values(phMap || {}));
        }).catch(err => console.error("Failed to fetch phases", err));

        accountingApi.listCategories().then(data => {
            setCategories(data);
            setAvailableAccounts(data);
            if (!accountName && data.length > 0) {
                setAccountName(data[0].name);
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
            // Use cat.id (UUID) — the backend getLedger filters by accountId (UUID primary key)
            const data = await accountingApi.getLedger(projectId, found.id, selectedPhaseId);
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
                const set = new Set(prev.split(','));
                if (set.has(strPid)) {
                    set.delete(strPid);
                } else {
                    set.add(strPid);
                }
                return set.size > 0 ? Array.from(set).join(',') : null;
            });
        } else {
            setSelectedPhaseId(prev => (String(prev) === strPid ? null : strPid));
        }
    };
    
    const selectedPhasesSet = useMemo(() => {
        return new Set(selectedPhaseId ? selectedPhaseId.split(',') : []);
    }, [selectedPhaseId]);
    
    // Determine normal balance side for display coloring
    const foundCategory = categories.find(c => c.name === accountName);
    const accountType = foundCategory?.type || 'ASSET'; // uses DB field name (uppercase)
    const normalBalance = ['ASSET', 'EXPENSE'].includes(accountType) ? 'DEBIT' : 'CREDIT';

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
                                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface)' }}>
                                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Date</th>
                                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Description</th>
                                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Phase</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Debit</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Credit</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Running Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                                                {formatDate(entry.date)}
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                {/* Strip the encoded metadata from description if legacy */}
                                                {(entry.description || '').split('|')[0].trim() || '-'}
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem' }}>
                                                <span style={{ fontSize: '0.75rem', background: 'var(--surface-hover)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                                    {/* Backend returns phaseName, not phase_name */}
                                                    {entry.phaseName || 'Project'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: entry.type === 'DEBIT' ? 600 : 400, color: entry.type === 'DEBIT' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                {/* Backend returns type: 'DEBIT' | 'CREDIT' */}
                                                {entry.type === 'DEBIT' ? formatCurrency(Number(entry.amount)) : '-'}
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: entry.type === 'CREDIT' ? 600 : 400, color: entry.type === 'CREDIT' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                {entry.type === 'CREDIT' ? formatCurrency(Number(entry.amount)) : '-'}
                                            </td>
                                            <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 700, color: Number(entry.runningBalance) < 0 ? 'var(--danger)' : 'var(--success)' }}>
                                                {/* Backend returns runningBalance, not running_balance */}
                                                {formatCurrency(Number(entry.runningBalance) || 0)}
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
                        const isSelected = selectedPhasesSet.has(String(ph.id));
                        return (
                            <button 
                                key={ph.id}
                                onClick={(e) => togglePhase(ph.id, e)}
                                style={{ 
                                    padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer',
                                    textAlign: 'center', fontWeight: isSelected ? 600 : 400,
                                    background: isSelected ? 'var(--primary)' : 'var(--surface)',
                                    color: isSelected ? '#fff' : 'var(--text-main)',
                                    border: '1px solid ' + (isSelected ? 'var(--primary)' : 'var(--border)'),
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
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
