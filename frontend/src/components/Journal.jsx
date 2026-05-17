import React, { useState, useEffect, useMemo } from 'react';
import { accountingApi, getImageUrl } from '../services/api';
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
    const [lightboxImage, setLightboxImage] = useState(null);
    const [lightboxTitle, setLightboxTitle] = useState('');

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

            <div className="journal-layout" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                <div className="table-container desktop-only">
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
                                    
                                    // Read fields directly from the database schema
                                    let pureDesc = tx.description || '-';
                                    let fromName = tx.fromEntity || '-';
                                    let toName = tx.toEntity || '-';
                                    let paymentMode = tx.paymentMode || '-';
                                    let refId = tx.reference || '';

                                    // Fallback for legacy transactions that stored metadata in the description string
                                    if (!tx.fromEntity && tx.description && tx.description.includes('| From:')) {
                                        const descString = tx.description;
                                        pureDesc = descString.split('|')[0].trim();
                                        
                                        const fromMatch = descString.match(/From:\s*(.*?)\s*To:/);
                                        const toMatch = descString.match(/To:\s*(.*?)\s*(?:\||$)/);
                                        const modeMatch = descString.match(/Mode:\s*(.*?)\s*(?:Ref:|$)/);
                                        const refMatch = descString.match(/Ref:\s*(.*)/);

                                        fromName = fromMatch ? fromMatch[1].trim() : '-';
                                        toName = toMatch ? toMatch[1].trim() : '-';
                                        paymentMode = modeMatch ? modeMatch[1].trim() : '-';
                                        refId = refMatch ? refMatch[1].trim() : '';
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
                                            <div style={{ marginBottom: '0.4rem' }}>{pureDesc}</div>
                                            {(tx.actualAmount || tx.cgst || tx.sgst || tx.igst || tx.discount) && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.4rem' }}>
                                                    {tx.actualAmount > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>Actual Amt: {formatCurrency(tx.actualAmount)}</span>}
                                                    {tx.cgst > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.4rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>CGST: {formatCurrency(tx.cgst)}</span>}
                                                    {tx.sgst > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.4rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>SGST: {formatCurrency(tx.sgst)}</span>}
                                                    {tx.igst > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.4rem', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>IGST: {formatCurrency(tx.igst)}</span>}
                                                    {tx.discount > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.4rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>Discount: {formatCurrency(tx.discount)}</span>}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                                                {tx.attachmentUrl && (
                                                    <button 
                                                        onClick={() => {
                                                            const url = getImageUrl(tx.attachmentUrl);
                                                            setLightboxImage(url);
                                                            setLightboxTitle(`${tx.description || 'Receipt'} - Bill`);
                                                        }}
                                                        style={{ 
                                                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem', 
                                                            fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', 
                                                            textTransform: 'uppercase', background: 'var(--surface-hover)', 
                                                            border: '1px solid var(--border)', padding: '0.25rem 0.6rem', 
                                                            borderRadius: '6px', cursor: 'pointer' 
                                                        }}
                                                    >
                                                        <FileText size={11} /> Bill
                                                    </button>
                                                )}
                                                {tx.gpayScreenshotUrl && (
                                                    <button 
                                                        onClick={() => {
                                                            const url = getImageUrl(tx.gpayScreenshotUrl);
                                                            setLightboxImage(url);
                                                            setLightboxTitle(`${tx.description || 'GPay'} - GPay / UPI`);
                                                        }}
                                                        style={{ 
                                                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem', 
                                                            fontSize: '0.7rem', fontWeight: 700, color: '#10b981', 
                                                            textTransform: 'uppercase', background: 'rgba(16, 185, 129, 0.05)', 
                                                            border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.25rem 0.6rem', 
                                                            borderRadius: '6px', cursor: 'pointer' 
                                                        }}
                                                    >
                                                        <span>📱</span> GPay / UPI
                                                    </button>
                                                )}
                                                {tx.materialImageUrl && (
                                                    <button 
                                                        onClick={() => {
                                                            const url = getImageUrl(tx.materialImageUrl);
                                                            setLightboxImage(url);
                                                            setLightboxTitle(`${tx.description || 'Material'} - Photo`);
                                                        }}
                                                        style={{ 
                                                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem', 
                                                            fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', 
                                                            textTransform: 'uppercase', background: 'rgba(59, 130, 246, 0.05)', 
                                                            border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.25rem 0.6rem', 
                                                            borderRadius: '6px', cursor: 'pointer' 
                                                        }}
                                                    >
                                                        <span>📷</span> Photo
                                                    </button>
                                                )}
                                            </div>
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

                {/* Mobile View Card List */}
                <div className="mobile-only" style={{ width: '100%' }}>
                    {loading ? (
                        <p style={{ color: 'var(--text-muted)' }}>Loading entries...</p>
                    ) : (
                        <div className="mobile-card-list">
                            {filtered.map(tx => {
                                const primaryAccount = tx.lines?.find(l => l.type === 'DEBIT')?.account?.name || 'Unknown';
                                const txAmount = tx.lines?.[0]?.amount || 0;
                                const isExpense = tx.lines?.some(l => l.account?.type === 'EXPENSE');

                                return (
                                    <div key={tx.id} className="mobile-card premium-hover">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }} onClick={() => onEdit(tx)}>
                                            <div className="mobile-card-icon" style={{ background: isExpense ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: isExpense ? 'var(--danger)' : 'var(--success)' }}>
                                                <FileText size={20} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.description || 'No Description'}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDate(tx.date)} • {primaryAccount}</div>
                                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                                                    {tx.attachmentUrl && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const url = getImageUrl(tx.attachmentUrl);
                                                                setLightboxImage(url);
                                                                setLightboxTitle(`${tx.description || 'Receipt'} - Bill`);
                                                            }}
                                                            style={{ 
                                                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem', 
                                                                fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', 
                                                                background: 'var(--surface-hover)', border: '1px solid var(--border)', 
                                                                padding: '0.15rem 0.4rem', borderRadius: '4px', cursor: 'pointer' 
                                                            }}
                                                        >
                                                            📄 Bill
                                                        </button>
                                                    )}
                                                    {tx.gpayScreenshotUrl && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const url = getImageUrl(tx.gpayScreenshotUrl);
                                                                setLightboxImage(url);
                                                                setLightboxTitle(`${tx.description || 'GPay'} - GPay / UPI`);
                                                            }}
                                                            style={{ 
                                                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem', 
                                                                fontSize: '0.65rem', fontWeight: 700, color: '#10b981', 
                                                                background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', 
                                                                padding: '0.15rem 0.4rem', borderRadius: '4px', cursor: 'pointer' 
                                                            }}
                                                        >
                                                            📱 GPay
                                                        </button>
                                                    )}
                                                    {tx.materialImageUrl && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const url = getImageUrl(tx.materialImageUrl);
                                                                setLightboxImage(url);
                                                                setLightboxTitle(`${tx.description || 'Material'} - Photo`);
                                                            }}
                                                            style={{ 
                                                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem', 
                                                                fontSize: '0.65rem', fontWeight: 700, color: '#3b82f6', 
                                                                background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', 
                                                                padding: '0.15rem 0.4rem', borderRadius: '4px', cursor: 'pointer' 
                                                            }}
                                                        >
                                                            📷 Photo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                            <div style={{ fontWeight: 800, color: isExpense ? 'var(--danger)' : 'var(--success)', fontSize: '0.9rem' }}>
                                                {isExpense ? '-' : '+'}{formatCurrency(txAmount)}
                                            </div>
                                            <div className="mobile-card-actions">
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{tx.paymentMode}</span>
                                                <button 
                                                   onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                                                   style={{ color: 'var(--danger)', padding: '4px', background: 'rgba(239, 68, 68, 0.05)', border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                                                >
                                                   <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filtered.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No transactions found.</p>}
                        </div>
                    )}
                </div>

                {/* Sidebar Filter for Desktop */}
                <div className="desktop-only" style={{ width: '120px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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

            {/* Mobile Phase Bar - Sticky at top below header */}
            <div className="mobile-only" style={{ overflowX: 'auto', display: 'flex', gap: '0.5rem', padding: '0.5rem 0', marginBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <button 
                    onClick={() => setSelectedPhaseId(null)}
                    style={{ 
                        whiteSpace: 'nowrap', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.75rem',
                        background: !selectedPhaseId ? 'var(--primary)' : 'var(--surface)',
                        color: !selectedPhaseId ? '#fff' : 'var(--text-main)',
                        border: '1px solid var(--border)'
                    }}
                >
                    All
                </button>
                {phases.map(ph => (
                    <button 
                        key={ph.id}
                        onClick={() => setSelectedPhaseId(String(ph.id))}
                        style={{ 
                            whiteSpace: 'nowrap', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.75rem',
                            background: selectedPhasesSet.has(String(ph.id)) ? 'var(--secondary)' : 'var(--surface)',
                            color: selectedPhasesSet.has(String(ph.id)) ? '#fff' : 'var(--text-main)',
                            border: '1px solid var(--border)'
                        }}
                    >
                        {ph.name}
                    </button>
                ))}
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

            {lightboxImage && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)',
                    zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '2rem'
                }} onClick={() => setLightboxImage(null)}>
                    <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '1rem' }}>
                        <button onClick={(e) => {
                            e.stopPropagation();
                            window.open(lightboxImage, '_blank');
                        }} style={{
                            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                            padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
                        }}>
                            📥 Open Original
                        </button>
                        <button onClick={() => setLightboxImage(null)} style={{
                            background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                            width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>✕</button>
                    </div>
                    <div style={{ color: '#fff', marginBottom: '1rem', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center' }}>{lightboxTitle}</div>
                    <div style={{
                        maxWidth: '90%', maxHeight: '80%', borderRadius: '12px', overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000'
                    }} onClick={e => e.stopPropagation()}>
                        {lightboxImage.toLowerCase().endsWith('.pdf') ? (
                            <iframe src={lightboxImage} style={{ width: '80vw', height: '75vh', border: 'none' }} title={lightboxTitle} />
                        ) : (
                            <img src={lightboxImage} style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} alt={lightboxTitle} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
