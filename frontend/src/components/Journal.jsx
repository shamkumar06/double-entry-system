import React, { useState, useEffect } from 'react';
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
        accountingApi.listProjects().then(projs => {
            const p = projs.find(pj => pj.logical_id === projectId);
            if (p && p.phases) {
                setPhases(Object.values(p.phases));
            }
        });
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

    const filtered = transactions.filter(tx => 
        tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>From</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>To</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Category</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Description</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>Amount</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((tx) => (
                                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)', opacity: deletingId === tx.id ? 0.4 : 1, transition: 'opacity 0.2s ease' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 500 }}>{tx.from_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(tx.transaction_date)}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{tx.from_payment_mode} {tx.from_reference ? `(${tx.from_reference})` : ''}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 500 }}>{tx.to_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(tx.transaction_date)}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{tx.to_payment_mode} {tx.to_reference ? `(${tx.to_reference})` : ''}</div>
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{tx.category_name}</td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                                            {tx.description}
                                            {tx.receipt_url && (
                                                <div style={{ marginTop: '0.4rem' }}>
                                                    <a href={tx.receipt_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--secondary)', textDecoration: 'none', background: 'rgba(56,189,248,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                        <FileText size={12} /> View Receipt
                                                    </a>
                                                </div>
                                            )}
                                            {tx.material_image_url && (
                                                <div style={{ marginTop: '0.4rem' }}>
                                                    <a href={tx.material_image_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--success)', textDecoration: 'none', background: 'rgba(34,197,94,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                        <FileText size={12} /> View Material
                                                    </a>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: tx.account_type === 'Revenue' ? 'var(--secondary)' : 'var(--text-main)' }}>
                                            {formatCurrency(tx.amount)}
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
                                ))}
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
