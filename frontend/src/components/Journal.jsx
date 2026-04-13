import React, { useState, useEffect, useMemo } from 'react';
import { accountingApi } from '../services/api';
import { FileText, Trash2, Edit2, Search } from 'lucide-react';
import { useFormatting } from '../context/SettingsContext';
import RecycleBin from './RecycleBin';

export default function Journal({ projectId, projectName, phaseId, phaseName, onEdit }) {
    const { formatCurrency, formatDate, sortData } = useFormatting();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [showRecycleBin, setShowRecycleBin] = useState(false);
    const [phases, setPhases] = useState([]);
    const [selectedPhaseId, setSelectedPhaseId] = useState(phaseId || null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchJournal = async () => {
        setLoading(true);
        try {
            const data = await accountingApi.getJournal(projectId, selectedPhaseId);
            setTransactions(sortData(data));
        } catch (error) {
            console.error("Failed to fetch journal", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        accountingApi.listPhases(projectId).then(phMap => {
            setPhases(Array.isArray(phMap) ? phMap : Object.values(phMap || {}));
        }).catch(err => console.error("Failed to fetch phases", err));
    }, [projectId]);

    useEffect(() => {
        setSelectedPhaseId(phaseId || null);
    }, [phaseId]);

    useEffect(() => {
        fetchJournal();
    }, [projectId, selectedPhaseId]);

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

    const handleDelete = async (txId) => {
        if (!window.confirm('Are you sure you want to move this transaction to the Recycle Bin? it will be removed from your active ledger.')) return;
        setDeletingId(txId);
        try {
            await accountingApi.deleteTransaction(txId);
            setTransactions(prev => prev.filter(tx => tx.id !== txId));
        } catch (error) {
            console.error("Failed to delete transaction", error);
            alert("Error deleting transaction. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    const filtered = useMemo(() => {
        if (!searchTerm) return transactions;
        const lowerSearch = searchTerm.toLowerCase();
        return transactions.filter(tx => {
            if (tx.description?.toLowerCase().includes(lowerSearch)) return true;
            return tx.lines?.some(l => l.account?.name?.toLowerCase().includes(lowerSearch));
        });
    }, [transactions, searchTerm]);

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FileText color="var(--primary)" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Journal (All Transactions)</h3>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                        <input 
                            type="text" 
                            placeholder="Search descriptions..." 
                            className="filter-input"
                            style={{ paddingLeft: '35px' }}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={() => setShowRecycleBin(true)}
                        style={{ 
                            fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 1.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer'
                        }}
                    >
                        <Trash2 size={16} /> Recycle Bin
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, overflowX: 'auto' }}>
                    {loading ? (
                        <p style={{ color: 'var(--text-muted)' }}>Loading entries...</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--primary)', opacity: 0.8 }}>
                                    <th style={{ padding: '1.25rem 1rem', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Origin</th>
                                    <th style={{ padding: '1.25rem 1rem', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destination</th>
                                    <th style={{ padding: '1.25rem 1rem', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</th>
                                    <th style={{ padding: '1.25rem 1rem', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Memo</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'right', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                                    <th style={{ padding: '1.25rem 1rem', textAlign: 'center', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Control</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((tx) => {
                                    // Extract core value and account from double entry subset
                                    let primaryAccount = tx.lines?.find(l => l.type === 'DEBIT')?.account?.name || 'Unknown';
                                    let txAmount = tx.lines?.[0]?.amount || 0;
                                    
                                    // Disassemble enriched description back into legacy atoms
                                    let pureDesc = tx.description;
                                    let fromName = '-';
                                    let toName = '-';
                                    let paymentMode = '-';
                                    let refId = '';
                                    
                                    if (tx.description?.includes('| From:')) {
                                        const parts = tx.description.split('|');
                                        pureDesc = parts[0]?.trim();
                                        
                                        const fromToMatch = parts[1]?.match(/From: (.*?) To: (.*)/);
                                        if (fromToMatch) {
                                            fromName = fromToMatch[1]?.trim();
                                            toName = fromToMatch[2]?.trim();
                                        }
                                        
                                        const modeRefMatch = parts[2]?.match(/Mode: (.*?) Ref: (.*)/);
                                        if (modeRefMatch) {
                                            paymentMode = modeRefMatch[1]?.trim();
                                            refId = modeRefMatch[2]?.trim();
                                        }
                                    }

                                    return (
                                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)', opacity: deletingId === tx.id ? 0.4 : 1, transition: 'opacity 0.2s ease' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 500 }}>{fromName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(tx.date)}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{paymentMode !== '-' ? paymentMode : ''} {refId && refId !== '-' ? `(${refId})` : ''}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 500 }}>{toName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(tx.date)}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{paymentMode !== '-' ? paymentMode : ''} {refId && refId !== '-' ? `(${refId})` : ''}</div>
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{primaryAccount}</td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                                            {pureDesc}
                                            {tx.attachmentUrl && (
                                                <div style={{ marginTop: '0.6rem' }}>
                                                    <a href={tx.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', textDecoration: 'none', background: 'var(--surface-hover)', border: '1px solid var(--border)', padding: '0.25rem 0.6rem', borderRadius: '6px' }}>
                                                        <FileText size={11} /> Receipt Attached
                                                    </a>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>
                                            {formatCurrency(txAmount)}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                            <button onClick={() => onEdit(tx)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(tx.id)}
                                                disabled={deletingId === tx.id}
                                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No entries found matching filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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

            {showRecycleBin && (
                <RecycleBin 
                    projectId={projectId} 
                    onClose={() => setShowRecycleBin(false)} 
                    onRestored={() => {
                        fetchJournal();
                        setShowRecycleBin(false);
                    }}
                />
            )}
        </div>
    );
}
