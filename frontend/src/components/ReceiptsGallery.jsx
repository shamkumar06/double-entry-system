import React, { useState, useEffect } from 'react';
import { X, ZoomIn, FileText, Calendar, Tag, DollarSign, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { accountingApi, getImageUrl } from '../services/api';
import { useCurrency } from '../context/SettingsContext';

export default function ReceiptsGallery({ projectId, phaseId }) {
    const { currency, formatCurrency } = useCurrency();
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [phases, setPhases] = useState([]);
    const [selectedPhaseId, setSelectedPhaseId] = useState(phaseId || 'all');
    const [activeTab, setActiveTab] = useState('letters'); // 'letters' | 'transactions'

    useEffect(() => {
        setSelectedPhaseId(phaseId || 'all');
    }, [phaseId]);

    useEffect(() => {
        if (!projectId) return;
        accountingApi.listPhases(projectId)
            .then(res => {
                setPhases(Array.isArray(res) ? res : []);
            })
            .catch(err => console.error('Failed to load phases for gallery dropdown:', err));
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        Promise.all([
            accountingApi.listPhases(projectId),
            accountingApi.getJournal(projectId, phaseId || null)
        ])
        .then(([phasesData, txs]) => {
            const phaseList = Array.isArray(phasesData) ? phasesData : (phasesData?.data || []);
            const list = (Array.isArray(txs) ? txs : txs?.data || []);
            const parsed = [];
            
            // 1. Unpack Phase Request Letters
            phaseList.forEach(phase => {
                if (phase.requestLetterUrl) {
                    const url = getImageUrl(phase.requestLetterUrl);
                    const isPdf = url?.toLowerCase().endsWith('.pdf');
                    parsed.push({
                        id: `${phase.id}-request-letter`,
                        txId: null,
                        tab: 'letters',
                        url,
                        isPdf,
                        type: 'letter',
                        suffix: 'Phase Request Letter',
                        description: `Official Funding Request Letter for Stage: "${phase.name}"`,
                        fromName: phase.receivedFrom || 'External Funder',
                        toName: phase.receivedTo || 'Project Entity',
                        amount: Number(phase.receivedAmount) || 0,
                        accountName: 'Initial Funding Deposit',
                        date: phase.createdAt || new Date(),
                        phaseName: phase.name,
                        phaseId: phase.id
                    });
                }
            });

            // 2. Unpack Transaction Attachments
            list.forEach(tx => {
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

                const createAttachment = (urlPath, type, suffix) => {
                    const url = getImageUrl(urlPath);
                    const isPdf = url?.toLowerCase().endsWith('.pdf');
                    return {
                        id: `${tx.id}-${type}`,
                        txId: tx.id,
                        tab: 'transactions',
                        url,
                        isPdf,
                        type,
                        suffix,
                        description: pureDesc,
                        fromName,
                        toName,
                        amount,
                        accountName,
                        date: tx.date,
                        phaseName: tx.phase?.name || 'Whole Project',
                        phaseId: tx.phaseId || tx.phase?.id || null
                    };
                };

                if (tx.attachmentUrl) {
                    parsed.push(createAttachment(tx.attachmentUrl, 'bill', 'Bill / Receipt'));
                }
                if (tx.gpayScreenshotUrl) {
                    parsed.push(createAttachment(tx.gpayScreenshotUrl, 'gpay', 'GPay / UPI Screenshot'));
                }
                if (tx.materialImageUrl) {
                    parsed.push(createAttachment(tx.materialImageUrl, 'material', 'Material Photo'));
                }
            });

            setReceipts(parsed);
        })
        .catch(e => console.error('Failed to load receipts', e))
        .finally(() => setLoading(false));
    }, [projectId, phaseId]);

    const filtered = receipts.filter(r => {
        // Tab filtering
        if (r.tab !== activeTab) return false;

        // Phase filtering
        if (selectedPhaseId !== 'all' && r.phaseId && String(r.phaseId) !== String(selectedPhaseId)) {
            return false;
        }

        // Type filtering
        if (filter === 'image' && r.isPdf) return false;
        if (filter === 'pdf' && !r.isPdf) return false;
        if (filter === 'bill' && r.type !== 'bill') return false;
        if (filter === 'gpay' && r.type !== 'gpay') return false;
        if (filter === 'material' && r.type !== 'material') return false;

        // Search filtering
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const desc = (r.description || '').toLowerCase();
            const suffix = (r.suffix || '').toLowerCase();
            const from = (r.fromName || '').toLowerCase();
            const to = (r.toName || '').toLowerCase();
            const ph = (r.phaseName || '').toLowerCase();
            const acc = (r.accountName || '').toLowerCase();
            return desc.includes(term) || suffix.includes(term) || from.includes(term) || to.includes(term) || ph.includes(term) || acc.includes(term);
        }

        return true;
    });

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setFilter('all');
        setSearchTerm('');
        setLightboxIndex(null);
    };

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

    const [downloadingId, setDownloadingId] = useState(null);

    const handleDownload = async (url, filename) => {
        setDownloadingId(url);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed', error);
            window.open(url, '_blank');
        } finally {
            setDownloadingId(null);
        }
    };

    const current = lightboxIndex !== null ? filtered[lightboxIndex] : null;

    const pills = activeTab === 'letters'
        ? [
            { id: 'all', label: '🗂 All' },
            { id: 'image', label: '🖼 Images' },
            { id: 'pdf', label: '📄 PDFs' }
          ]
        : [
            { id: 'all', label: '🗂 All Attachments' },
            { id: 'bill', label: '📄 Bills / Invoices' },
            { id: 'gpay', label: '📱 GPay / UPI' },
            { id: 'material', label: '📷 Material Photos' },
            { id: 'pdf', label: '📕 PDFs' }
          ];

    return (
        <div className="glass-panel attachments-panel">
            {/* Header */}
            <div className="attachments-header" style={{ marginBottom: '1.75rem', flexWrap: 'wrap' }}>
                <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        {activeTab === 'letters' ? '✉️ Phase Request Letters' : '🧾 Transaction Attachments'}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {filtered.length} {activeTab === 'letters' ? `request letter${filtered.length !== 1 ? 's' : ''}` : `attachment${filtered.length !== 1 ? 's' : ''}`} found
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Phase Filter Dropdown */}
                    {!phaseId && phases.length > 0 && (
                        <select
                            value={selectedPhaseId}
                            onChange={e => setSelectedPhaseId(e.target.value)}
                            style={{
                                padding: '0.5rem 2rem 0.5rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text-main)',
                                fontSize: '0.875rem',
                                outline: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                                appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='rgba%28156, 163, 175, 0.8%29' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.5rem center',
                                backgroundSize: '1.25em',
                                minWidth: '160px'
                            }}
                        >
                            <option value="all">📁 All Stages / Phases</option>
                            {phases.map(ph => (
                                <option key={ph.id} value={ph.id}>
                                    🔖 {ph.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Search */}
                    <input
                        type="text"
                        placeholder={activeTab === 'letters' ? "Search letters..." : "Search receipts..."}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.875rem', width: '200px' }}
                    />
                    {/* Filter pills */}
                    {pills.map(p => (
                        <button key={p.id} onClick={() => setFilter(p.id)}
                            style={{
                                padding: '0.4rem 1rem',
                                borderRadius: '20px',
                                border: '1px solid var(--border)',
                                background: filter === p.id ? 'var(--primary)' : 'var(--surface)',
                                color: filter === p.id ? '#fff' : 'var(--text-muted)',
                                fontWeight: filter === p.id ? 600 : 400,
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                textTransform: 'capitalize',
                                transition: 'all 0.15s ease',
                            }}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Premium Glassmorphic Tabs */}
            <div className="attachments-tab-bar" style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                background: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid var(--border)', 
                padding: '0.35rem', 
                borderRadius: '12px', 
                marginBottom: '2rem',
                width: 'fit-content'
            }}>
                <button 
                    onClick={() => handleTabChange('letters')}
                    style={{
                        padding: '0.6rem 1.5rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === 'letters' ? 'var(--primary)' : 'transparent',
                        color: activeTab === 'letters' ? '#fff' : 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    <span>✉️</span> Phase Request Letters
                </button>
                <button 
                    onClick={() => handleTabChange('transactions')}
                    style={{
                        padding: '0.6rem 1.5rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === 'transactions' ? 'var(--primary)' : 'transparent',
                        color: activeTab === 'transactions' ? '#fff' : 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    <span>🧾</span> Transaction Attachments
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                    Loading {activeTab === 'letters' ? 'request letters...' : 'attachments...'}
                </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
                        {activeTab === 'letters' ? '✉️' : '🧾'}
                    </div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                        {activeTab === 'letters' ? 'No Request Letters yet' : 'No Transaction Attachments yet'}
                    </p>
                    <p style={{ fontSize: '0.875rem' }}>
                        {activeTab === 'letters' 
                            ? 'Attach request letters when creating or editing project phases' 
                            : 'Upload attachments or bills when adding transactions'}
                    </p>
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
                                        onError={e => { 
                                            e.currentTarget.style.display = 'none';
                                            const placeholder = document.createElement('div');
                                            placeholder.style.cssText = 'height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.5rem; color:var(--text-muted); padding:1rem; text-align:center;';
                                            placeholder.innerHTML = `<span style="font-size:2rem;">📷</span><span style="font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Image Preview</span>`;
                                            e.currentTarget.parentElement.appendChild(placeholder);
                                        }}
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
                                {/* Type Badge */}
                                <div style={{ 
                                    position: 'absolute', top: '8px', left: '8px', 
                                    background: r.type === 'bill' ? 'rgba(2, 132, 199, 0.95)' : r.type === 'gpay' ? 'rgba(16, 185, 129, 0.95)' : r.type === 'material' ? 'rgba(59, 130, 246, 0.95)' : 'rgba(139, 92, 246, 0.95)', 
                                    color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '20px',
                                    display: 'flex', alignItems: 'center', gap: '0.2rem',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                                }}>
                                    {r.type === 'bill' ? '📄 Bill' : r.type === 'gpay' ? '📱 GPay' : r.type === 'material' ? '📷 Photo' : '✉️ Request Letter'}
                                </div>
                                {/* Phase badge */}
                                <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(2,132,199,0.9)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '20px' }}>
                                    {r.phaseName}
                                </div>
                            </div>

                            {/* Card details */}
                            <div style={{ padding: '0.875rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                                    <span style={{ 
                                        background: r.type === 'bill' ? 'rgba(2, 132, 199, 0.1)' : r.type === 'gpay' ? 'rgba(16, 185, 129, 0.1)' : r.type === 'material' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)', 
                                        color: r.type === 'bill' ? 'var(--primary)' : r.type === 'gpay' ? '#10b981' : r.type === 'material' ? '#3b82f6' : '#8b5cf6',
                                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase'
                                    }}>
                                        {r.suffix}
                                    </span>
                                </div>
                                <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>
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
                                <div style={{ marginTop: '0.5rem' }}>
                                    <span style={{ 
                                        background: current.type === 'bill' ? 'rgba(2, 132, 199, 0.2)' : current.type === 'gpay' ? 'rgba(16, 185, 129, 0.2)' : current.type === 'material' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(139, 92, 246, 0.2)', 
                                        color: current.type === 'bill' ? '#38bdf8' : current.type === 'gpay' ? '#34d399' : current.type === 'material' ? '#60a5fa' : '#c084fc',
                                        padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                                        border: '1px solid rgba(255,255,255,0.05)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                                    }}>
                                        {current.type === 'bill' ? '📄 Bill / Receipt' : current.type === 'gpay' ? '📱 GPay / UPI' : current.type === 'material' ? '📷 Material Photo' : '✉️ Request Letter'}
                                    </span>
                                </div>
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
                                <button
                                    onClick={() => handleDownload(current.url, `${current.description || 'Receipt'}.${current.isPdf ? 'pdf' : 'png'}`)}
                                    disabled={downloadingId === current.url}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                                        background: 'var(--primary)', color: 'white',
                                        borderRadius: '10px', padding: '0.75rem 1.25rem',
                                        fontSize: '0.9rem', fontWeight: 700, border: 'none',
                                        transition: 'all 0.2s ease',
                                        width: '100%', justifyContent: 'center', cursor: 'pointer',
                                        opacity: downloadingId === current.url ? 0.7 : 1,
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                    <Download size={16} className={downloadingId === current.url ? 'spin' : ''} />
                                    {downloadingId === current.url ? 'Downloading...' : 'Download File'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
