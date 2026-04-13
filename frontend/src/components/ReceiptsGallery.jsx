import React, { useState, useEffect } from 'react';
import { X, ZoomIn, FileText, Calendar, Tag, DollarSign, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { accountingApi } from '../services/api';
import { useCurrency } from '../context/SettingsContext';

export default function ReceiptsGallery({ projectId, phaseId }) {
    const { currency, formatCurrency } = useCurrency();
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all' | 'image' | 'pdf'
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        accountingApi.getJournal(projectId, phaseId || null)
            .then(txs => {
                const parsed = (Array.isArray(txs) ? txs : txs?.data || [])
                    .filter(tx => tx.attachmentUrl)
                    .map(tx => {
                        // Unpack enriched description
                        let pureDesc = tx.description;
                        let fromName = '';
                        let toName = '';
                        let amount = tx.lines?.[0]?.amount || 0;
                        let accountName = tx.lines?.find(l => l.type === 'DEBIT')?.account?.name || '';

                        if (tx.description?.includes('| From:')) {
                            const parts = tx.description.split('|');
                            pureDesc = parts[0]?.trim();
                            const m = parts[1]?.match(/From: (.*?) To: (.*)/);
                            if (m) { fromName = m[1]?.trim(); toName = m[2]?.trim(); }
                        }

                        const url = tx.attachmentUrl;
                        const isPdf = url?.toLowerCase().endsWith('.pdf');

                        return {
                            id: tx.id,
                            url,
                            isPdf,
                            description: pureDesc,
                            fromName,
                            toName,
                            amount,
                            accountName,
                            date: tx.date,
                            phaseName: tx.phase?.name || 'Whole Project',
                        };
                    });
                setReceipts(parsed);
            })
            .catch(e => console.error('Failed to load receipts', e))
            .finally(() => setLoading(false));
    }, [projectId, phaseId]);

    const filtered = receipts.filter(r => {
        const matchFilter = filter === 'all' || (filter === 'pdf' && r.isPdf) || (filter === 'image' && !r.isPdf);
        const matchSearch = !searchTerm || r.description?.toLowerCase().includes(searchTerm.toLowerCase()) || r.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) || r.fromName?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchFilter && matchSearch;
    });

    const openLightbox = (idx) => setLightboxIndex(idx);
    const closeLightbox = () => setLightboxIndex(null);
    const prev = () => setLightboxIndex(i => (i - 1 + filtered.length) % filtered.length);
    const next = () => setLightboxIndex(i => (i + 1) % filtered.length);

    const formatDate = (d) => {
        if (!d) return '';
        return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatAmount = (amt) => {
        return formatCurrency(amt);
    };

    const current = lightboxIndex !== null ? filtered[lightboxIndex] : null;

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        🧾 Receipts & Attachments
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {filtered.length} attachment{filtered.length !== 1 ? 's' : ''} found
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search receipts..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.875rem', width: '200px' }}
                    />
                    {/* Filter pills */}
                    {['all', 'image', 'pdf'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            style={{
                                padding: '0.4rem 1rem',
                                borderRadius: '20px',
                                border: '1px solid var(--border)',
                                background: filter === f ? 'var(--primary)' : 'var(--surface)',
                                color: filter === f ? '#fff' : 'var(--text-muted)',
                                fontWeight: filter === f ? 600 : 400,
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                textTransform: 'capitalize',
                                transition: 'all 0.15s ease',
                            }}>
                            {f === 'all' ? '🗂 All' : f === 'image' ? '🖼 Images' : '📄 PDFs'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                    Loading receipts...
                </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗂️</div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>No attachments yet</p>
                    <p style={{ fontSize: '0.875rem' }}>Upload receipts or bills when adding transactions</p>
                </div>
            )}

            {/* Gallery grid */}
            {!loading && filtered.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '1.25rem',
                }}>
                    {filtered.map((r, idx) => (
                        <div key={r.id}
                            onClick={() => openLightbox(idx)}
                            style={{
                                borderRadius: '14px',
                                overflow: 'hidden',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                            }}
                        >
                            {/* Thumbnail */}
                            <div style={{ position: 'relative', height: '180px', background: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                                {r.isPdf ? (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                                        <FileText size={48} strokeWidth={1} color="var(--primary)" />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>PDF Document</span>
                                    </div>
                                ) : (
                                    <img src={r.url} alt={r.description}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                        onError={e => { e.currentTarget.style.display = 'none'; }}
                                    />
                                )}
                                {/* Zoom overlay */}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'rgba(0,0,0,0)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 0.2s ease',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.35)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}
                                >
                                    <ZoomIn size={28} color="white" style={{ opacity: 0, transition: 'opacity 0.2s ease' }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                        onMouseLeave={e => e.currentTarget.style.opacity = 0}
                                    />
                                </div>
                                {/* Phase badge */}
                                <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(2,132,199,0.9)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '20px' }}>
                                    {r.phaseName}
                                </div>
                            </div>

                            {/* Card details */}
                            <div style={{ padding: '0.875rem' }}>
                                <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.description || 'No description'}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <Calendar size={11} /> {formatDate(r.date)}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <Tag size={11} /> {r.accountName || 'Unknown account'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.2rem' }}>
                                        <DollarSign size={11} /> {formatAmount(r.amount)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {current && (
                <div
                    onClick={closeLightbox}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 2000,
                        background: 'rgba(0,0,0,0.92)',
                        display: 'block', // Changed from flex to block to support scrolling
                        overflowY: 'auto', // Enable scrolling
                        padding: '2rem 1rem',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    <div onClick={e => e.stopPropagation()} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        maxWidth: '900px', width: '100%', gap: '1.5rem',
                        margin: '0 auto', // Center horizontally
                        minHeight: 'min-content',
                    }}>
                        {/* Close button - now sticky/fixed at top right of viewport */}
                        <button onClick={closeLightbox} style={{
                            position: 'fixed', top: '1.25rem', right: '2rem',
                            background: 'rgba(255,255,255,0.15)', border: 'none',
                            borderRadius: '50%', width: '44px', height: '44px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'white', zIndex: 100,
                            backdropFilter: 'blur(4px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}>
                            <X size={24} />
                        </button>

                        {/* Nav arrows - kept fixed */}
                        {filtered.length > 1 && (
                            <>
                                <button onClick={prev} style={{
                                    position: 'fixed', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                                    width: '44px', height: '44px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', cursor: 'pointer', color: 'white',
                                    zIndex: 10,
                                }}>
                                    <ChevronLeft size={22} />
                                </button>
                                <button onClick={next} style={{
                                    position: 'fixed', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                                    width: '44px', height: '44px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', cursor: 'pointer', color: 'white',
                                    zIndex: 10,
                                }}>
                                    <ChevronRight size={22} />
                                </button>
                            </>
                        )}

                        {/* Counter pill at the top */}
                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', fontWeight: 600, background: 'rgba(255,255,255,0.1)', padding: '0.4rem 1rem', borderRadius: '20px' }}>
                            {lightboxIndex + 1} / {filtered.length}
                        </div>

                        {/* Image / PDF view */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '40vh' }}>
                            {current.isPdf ? (
                                <iframe src={current.url} title="PDF Viewer" style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '12px', background: '#fff' }} />
                            ) : (
                                <img src={current.url} alt={current.description}
                                    style={{ maxHeight: '75vh', maxWidth: '100%', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
                                />
                            )}
                        </div>

                        {/* Details card */}
                        <div style={{
                            background: 'rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: '20px',
                            padding: '1.75rem 2rem',
                            width: '100%',
                            border: '1px solid rgba(255,255,255,0.12)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: '1.5rem',
                            marginBottom: '2rem',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        }}>
                            <div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Description</div>
                                <div style={{ color: 'white', fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 }}>{current.description || 'No description provided'}</div>
                            </div>
                            <div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Date</div>
                                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>{formatDate(current.date)}</div>
                            </div>
                            <div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Account</div>
                                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>{current.accountName || '—'}</div>
                            </div>
                            <div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Amount</div>
                                <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '1.25rem' }}>{formatAmount(current.amount)}</div>
                            </div>
                            {current.fromName && (
                                <div style={{ gridColumn: 'span 1' }}>
                                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Entities</div>
                                    <div style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem', opacity: 0.9 }}>{current.fromName} → {current.toName}</div>
                                </div>
                            )}
                            <div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Phase</div>
                                <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.95rem' }}>{current.phaseName}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <a href={current.url} download target="_blank" rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                                        background: 'var(--primary)', color: 'white',
                                        borderRadius: '10px', padding: '0.75rem 1.25rem',
                                        fontSize: '0.9rem', fontWeight: 700, textDecoration: 'none',
                                        transition: 'all 0.2s ease',
                                        width: '100%', justifyContent: 'center',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                    <Download size={16} /> Download File
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
