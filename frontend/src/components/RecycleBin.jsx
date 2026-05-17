import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { Trash2, RefreshCcw, X, AlertCircle } from 'lucide-react';
import { useFormatting } from '../context/SettingsContext';

export default function RecycleBin({ projectId, onClose, onRestored }) {
    const { formatCurrency, formatDate } = useFormatting();
    const [deletedTxs, setDeletedTxs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [restoringId, setRestoringId] = useState(null);
    const [error, setError] = useState(null);

    const fetchDeleted = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await accountingApi.listDeleted(projectId);
            setDeletedTxs(Array.isArray(data) ? data : []);
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
            alert("Failed to restore transaction: " + (err?.error || err?.message || 'Unknown error'));
        } finally {
            setRestoringId(null);
        }
    };

    // Extract display info from the Prisma transaction shape
    const getTxDisplay = (tx) => {
        // Category = primary account name (first debit line's account, or first line)
        const primaryLine = tx.lines?.find(l => l.type === 'DEBIT') || tx.lines?.[0];
        const categoryName = primaryLine?.account?.name || 'Uncategorized';

        // Amount = first line's amount
        const amount = primaryLine ? Number(primaryLine.amount) : 0;

        // Phase name
        const phaseName = tx.phase?.name || 'No Phase';

        // From / To
        const fromName = tx.fromEntity || '-';
        const toName = tx.toEntity || '-';

        // Date
        const dateStr = tx.date ? formatDate(tx.date) : tx.deletedAt ? formatDate(tx.deletedAt) : '-';

        // Description
        const description = tx.description || '';

        return { categoryName, amount, phaseName, fromName, toName, dateStr, description };
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
                background: 'var(--surface)',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border)'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '1.25rem', right: '1.25rem',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    padding: '0.25rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s'
                }}>
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
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading deleted records...</p>
                ) : error ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)' }}>
                        <AlertCircle size={32} style={{ marginBottom: '0.5rem' }} />
                        <p>{error}</p>
                    </div>
                ) : deletedTxs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <Trash2 size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                        <p>Recycle bin is empty.</p>
                    </div>
                ) : (
                    <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {deletedTxs.map(tx => {
                            const { categoryName, amount, phaseName, fromName, toName, dateStr, description } = getTxDisplay(tx);
                            return (
                                <div key={tx.id} className="recycle-bin-item" style={{
                                    padding: '1rem 1.25rem', borderRadius: '12px', background: 'var(--surface-hover)',
                                    border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    transition: 'all 0.2s ease',
                                    opacity: restoringId === tx.id ? 0.5 : 1
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{categoryName}</span>
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 600,
                                                background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent)',
                                                padding: '2px 8px', borderRadius: '6px',
                                                border: '1px solid rgba(56, 189, 248, 0.2)'
                                            }}>
                                                {phaseName}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                            {dateStr} · {fromName} → {toName}
                                        </p>
                                        {description && (
                                            <p style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '0.2rem', opacity: 0.8 }}>
                                                "{description}"
                                            </p>
                                        )}
                                    </div>
                                    <div className="recycle-bin-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                            {formatCurrency(amount)}
                                        </span>
                                        <button
                                            className="btn-primary"
                                            onClick={() => handleRestore(tx.id)}
                                            disabled={restoringId === tx.id}
                                            style={{
                                                padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                fontSize: '0.85rem', borderRadius: '10px'
                                            }}
                                        >
                                            <RefreshCcw size={14} className={restoringId === tx.id ? 'spin' : ''} />
                                            {restoringId === tx.id ? 'Restoring...' : 'Restore'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
