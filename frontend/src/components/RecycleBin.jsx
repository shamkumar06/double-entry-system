import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { Trash2, RefreshCcw, X, AlertCircle } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';

export default function RecycleBin({ projectId, onClose, onRestored }) {
    const { format } = useCurrency();
    const [deletedTxs, setDeletedTxs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [restoringId, setRestoringId] = useState(null);
    const [error, setError] = useState(null);

    const fetchDeleted = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await accountingApi.listDeleted(projectId);
            // Sort by descending date
            setDeletedTxs(data.sort((a,b) => (b.transaction_date || '').localeCompare(a.transaction_date || '')));
        } catch (err) {
            setError("Failed to load recycle bin");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeleted();
    }, [projectId]);

    const handleRestore = async (txId) => {
        setRestoringId(txId);
        try {
            await accountingApi.restoreTransaction(txId);
            setDeletedTxs(prev => prev.filter(t => t.id !== txId));
            if (onRestored) onRestored();
        } catch (err) {
            alert("Failed to restore transaction: " + (err.response?.data?.detail || err.message));
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(8px)'
        }}>
            <div className="glass-panel" style={{
                width: '90%', maxWidth: '800px', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                padding: '1.5rem', position: 'relative',
                background: 'var(--card-bg, #1e293b)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--border)'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '1.25rem', right: '1.25rem',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    padding: '0.25rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s'
                }} className="hover-bg-surface">
                    <X size={24} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Trash2 size={24} color="var(--danger)" />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Recycle Bin</h2>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    Transactions deleted from the ledger are kept here. Restoring them will re-calculate the project balance.
                </p>

                {loading ? (
                    <p style={{ textAlign: 'center', padding: '2rem' }}>Loading deleted records...</p>
                ) : error ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)' }}>
                        <AlertCircle size={32} style={{ marginBottom: '0.5rem' }} />
                        <p>{error}</p>
                    </div>
                ) : deletedTxs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <p>Recycle bin is empty.</p>
                    </div>
                ) : (
                    <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {deletedTxs.map(tx => (
                            <div key={tx.id} style={{
                                padding: '1rem', borderRadius: '12px', background: 'var(--surface)',
                                border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: 600 }}>{tx.category_name}</span>
                                        <span style={{ fontSize: '0.75rem', background: 'var(--surface-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                                            {tx.phase_name || 'Uncategorized'}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                        {tx.transaction_date} · {tx.from_name} ➔ {tx.to_name}
                                    </p>
                                    {tx.description && <p style={{ fontSize: '0.75rem', fontStyle: 'italic', marginTop: '0.2rem' }}>"{tx.description}"</p>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{format(tx.amount)}</span>
                                    <button 
                                        className="btn-primary" 
                                        onClick={() => handleRestore(tx.id)}
                                        disabled={restoringId === tx.id}
                                        style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--secondary)' }}
                                    >
                                        <RefreshCcw size={16} className={restoringId === tx.id ? 'spin' : ''} />
                                        {restoringId === tx.id ? 'Restoring...' : 'Restore'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
