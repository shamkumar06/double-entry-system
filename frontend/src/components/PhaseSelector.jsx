import React, { useState, useEffect } from 'react';
import { accountingApi, getImageUrl } from '../services/api';
import { GitBranch, Plus, Trash2, ArrowRight, ChevronLeft, Edit2 } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';
import ConfirmationDialog from './ConfirmationDialog';

export default function PhaseSelector({ project, onSelectPhase, onBack }) {
    const { formatCurrency, symbol } = useCurrency();
    const [phases, setPhases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newPhase, setNewPhase] = useState({ 
        name: '', description: '', estimatedBudget: '',
        received_amount: '',
        received_from: '', received_to: '',
        payment_mode: 'Bank Transfer', reference: '',
        request_letter_url: ''
    });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ 
        name: '', description: '', estimatedBudget: '',
        received_amount: '',
        received_from: '', received_to: '',
        payment_mode: 'Bank Transfer', reference: '',
        request_letter_url: '',
        isSettled: false
    });
    const [uploadingRequestLetter, setUploadingRequestLetter] = useState(false);

    // ── Custom Confirmation Dialog state ─────────────
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        type: 'danger',
        onConfirm: () => {}
    });

    const triggerConfirm = ({ title, message, confirmText, cancelText, type, onConfirm }) => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            confirmText,
            cancelText,
            type,
            onConfirm: () => {
                onConfirm();
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const fetchPhases = async () => {
        setLoading(true);
        try {
            const [phasesData, txs] = await Promise.all([
                accountingApi.listPhases(project.id),
                accountingApi.getJournal(project.id, null)
            ]);
            const list = Array.isArray(txs) ? txs : (txs?.data || []);
            const phasesArray = Array.isArray(phasesData) ? phasesData : (phasesData?.data || []);

            const mappedPhases = phasesArray.map(phase => {
                let spent_amount = 0;
                list.forEach(tx => {
                    if (tx.phaseId === phase.id || tx.phase?.id === phase.id) {
                        tx.lines?.forEach(line => {
                            if (line.type === 'DEBIT') {
                                spent_amount += parseFloat(line.amount) || 0;
                            }
                        });
                    }
                });
                return {
                    ...phase,
                    spent_amount
                };
            });
            setPhases(mappedPhases);
        } catch (e) {
            console.error("Failed to load phases", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPhases(); }, [project.id]);

    const handleRequestLetterChange = async (e, isEdit = false) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingRequestLetter(true);
        try {
            const url = await accountingApi.uploadReceipt(file, 'letters');
            if (isEdit) {
                setEditData(prev => ({ ...prev, request_letter_url: url }));
            } else {
                setNewPhase(prev => ({ ...prev, request_letter_url: url }));
            }
        } catch (err) {
            console.error("Upload error", err);
            alert("Failed to upload request letter. " + (err?.error || err.message));
        } finally {
            setUploadingRequestLetter(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newPhase.name.trim()) return;
        
        const newAlloc = parseFloat(newPhase.estimatedBudget) || 0;
        const currentTotalAlloc = phases.reduce((acc, ph) => acc + (ph.estimatedBudget || 0), 0);
        const totalRequired = currentTotalAlloc + newAlloc;

        const proceedCreate = async (shouldUpdateBudget = false) => {
            setSaving(true);
            try {
                if (shouldUpdateBudget) {
                    await accountingApi.updateProject(project.id, { totalFunds: totalRequired });
                    project.totalFunds = totalRequired;
                }

                const receivedAmt = parseFloat(newPhase.received_amount) || 0;
                await accountingApi.createPhase(project.id, {
                    name: newPhase.name.trim(),
                    description: newPhase.description.trim(),
                    estimatedBudget: newAlloc,
                    receivedAmount: receivedAmt,
                    receivedFrom: newPhase.received_from.trim(),
                    receivedTo: newPhase.received_to.trim(),
                    paymentMode: newPhase.payment_mode,
                    reference: newPhase.reference.trim(),
                    requestLetterUrl: newPhase.request_letter_url
                });
                setNewPhase({ 
                    name: '', description: '', estimatedBudget: '',
                    received_amount: '',
                    received_from: '', received_to: '',
                    payment_mode: 'Bank Transfer', reference: '',
                    request_letter_url: ''
                });
                setCreating(false);
                await fetchPhases();
            } catch (err) {
                console.error("Phase creation error:", err);
                const detail = err?.response?.data?.detail || err?.message || "Unknown error";
                alert(`Error creating phase: ${detail}`);
            } finally {
                setSaving(false);
            }
        };

        if (totalRequired > (project.totalFunds || 0)) {
            triggerConfirm({
                title: 'Increase Project Budget?',
                message: `This new phase pushes the total allocation (₹${totalRequired.toLocaleString()}) above the Project Budget (₹${project.totalFunds?.toLocaleString()}). \n\nWould you like to increase the Project Budget to ₹${totalRequired.toLocaleString()}?`,
                confirmText: 'Increase & Create',
                cancelText: 'Cancel',
                type: 'info',
                onConfirm: () => proceedCreate(true)
            });
        } else {
            proceedCreate(false);
        }
    };

    const handleUpdate = async (e, phaseId) => {
        e.preventDefault();
        if (!editData.name.trim()) return;

        const newAlloc = parseFloat(editData.estimatedBudget) || 0;
        const otherPhasesAlloc = phases
            .filter(ph => ph.id !== phaseId)
            .reduce((acc, ph) => acc + (ph.estimatedBudget || 0), 0);
        
        const totalRequired = otherPhasesAlloc + newAlloc;

        const proceedUpdate = async (shouldUpdateBudget = false) => {
            setSaving(true);
            try {
                if (shouldUpdateBudget) {
                    await accountingApi.updateProject(project.id, { totalFunds: totalRequired });
                    project.totalFunds = totalRequired;
                }

                const receivedAmt = parseFloat(editData.received_amount) || 0;
                await accountingApi.updatePhase(project.id, phaseId, {
                    name: editData.name.trim(),
                    description: editData.description.trim(),
                    estimatedBudget: newAlloc,
                    receivedAmount: receivedAmt,
                    receivedFrom: editData.received_from.trim(),
                    receivedTo: editData.received_to.trim(),
                    paymentMode: editData.payment_mode,
                    reference: editData.reference.trim(),
                    requestLetterUrl: editData.request_letter_url,
                    isSettled: editData.isSettled
                });
                setEditingId(null);
                await fetchPhases();
            } catch (err) {
                console.error("Phase update error:", err);
                const detail = err?.response?.data?.detail || err?.message || "Unknown error";
                alert(`Error updating phase: ${detail}`);
            } finally {
                setSaving(false);
            }
        };

        if (totalRequired > (project.totalFunds || 0)) {
            triggerConfirm({
                title: 'Increase Project Budget?',
                message: `Updating this phase pushes the total allocation (₹${totalRequired.toLocaleString()}) above the Project Budget (₹${project.totalFunds?.toLocaleString()}). \n\nWould you like to increase the Project Budget to ₹${totalRequired.toLocaleString()}?`,
                confirmText: 'Increase & Update',
                cancelText: 'Cancel',
                type: 'info',
                onConfirm: () => proceedUpdate(true)
            });
        } else {
            proceedUpdate(false);
        }
    };

    const startEdit = (phase) => {
        setCreating(false);
        setEditingId(phase.id);
        setEditData({
            name: phase.name,
            description: phase.description || '',
            estimatedBudget: phase.estimatedBudget || '',
            received_amount: phase.receivedAmount || '',
            received_from: phase.receivedFrom || '',
            received_to: phase.receivedTo || '',
            payment_mode: phase.paymentMode || 'Bank Transfer',
            reference: phase.reference || '',
            request_letter_url: phase.requestLetterUrl || '',
            isSettled: phase.isSettled || false
        });
    };

    const handleDelete = async (phaseId, phaseName) => {
        triggerConfirm({
            title: 'Delete Phase',
            message: `Delete "${phaseName}"? All transactions in this phase will be moved to the Recycle Bin.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            type: 'danger',
            onConfirm: async () => {
                setDeletingId(phaseId);
                try {
                    await accountingApi.deletePhase(project.id, phaseId);
                    setPhases(p => p.filter(ph => ph.id !== phaseId));
                } catch {
                    alert("Error deleting phase");
                } finally {
                    setDeletingId(null);
                }
            }
        });
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', gap: '2rem', background: 'var(--background)' }}>
            <div style={{ maxWidth: '1200px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={onBack} className="btn-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        <ChevronLeft size={16} /> Back to Projects
                    </button>
                    {project.logoUrl && (
                        <img 
                            src={getImageUrl(project.logoUrl)} 
                            alt="Project Logo" 
                            style={{ 
                                height: '48px', 
                                width: 'auto', 
                                objectFit: 'contain',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'white',
                                padding: '4px'
                            }} 
                        />
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)' }}>
                        <GitBranch size={24} />
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em' }}>Project Stages & Budgets</h2>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Manage individual phase structures, initialize local funding pipelines, and review real-time budget utilization metrics for <strong>{project.name}</strong>.
                    </p>
                </div>

                {/* Overall Project Summary Dashboard */}
                {!loading && phases.length > 0 && (
                    <div className="glass-panel animate-in" style={{ 
                        padding: '1.75rem', 
                        borderRadius: '24px', 
                        background: 'var(--surface-card, #0f172a)', 
                        border: '1px solid var(--border)', 
                        boxShadow: 'var(--shadow-md)',
                        marginBottom: '1rem'
                    }}>
                        <h3 style={{ 
                            fontSize: '0.8rem', 
                            fontWeight: 800, 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.1em', 
                            color: 'var(--primary)', 
                            margin: '0 0 1.25rem 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            📊 Project-Wide Financial Overview
                        </h3>
                        
                        <div className="responsive-grid" style={{ 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                            gap: '1.25rem' 
                        }}>
                            {/* Card 1: Project Budget vs Phase Budgets */}
                            <div style={{ background: 'var(--surface)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Project Budget</span>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                                    {formatCurrency(project.totalFunds || 0)}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                                    Phase Allocations: <strong>{formatCurrency(phases.reduce((sum, p) => sum + (parseFloat(p.estimatedBudget) || 0), 0))}</strong>
                                </span>
                            </div>

                            {/* Card 2: Total Received Funds */}
                            <div style={{ background: 'var(--surface)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Received Funds</span>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.25rem' }}>
                                    {formatCurrency(phases.reduce((sum, p) => sum + (parseFloat(p.receivedAmount) || 0), 0))}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                                    Across all initialized stages
                                </span>
                            </div>

                            {/* Card 3: Total Spent / Disbursed */}
                            <div style={{ background: 'var(--surface)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Spent / Disbursed</span>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>
                                    {formatCurrency(phases.reduce((sum, p) => sum + (parseFloat(p.spent_amount) || 0), 0))}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                                    From journal transactions
                                </span>
                            </div>

                            {/* Card 4: Pipeline Balance */}
                            <div style={{ background: 'var(--surface)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Remaining Balance</span>
                                <div style={{ 
                                    fontSize: '1.35rem', 
                                    fontWeight: 800, 
                                    color: (phases.reduce((sum, p) => sum + (parseFloat(p.receivedAmount) || 0), 0) - phases.reduce((sum, p) => sum + (parseFloat(p.spent_amount) || 0), 0)) < 0 ? 'var(--danger)' : 'var(--text-main)', 
                                    marginTop: '0.25rem' 
                                }}>
                                    {formatCurrency(
                                        phases.reduce((sum, p) => sum + (parseFloat(p.receivedAmount) || 0), 0) - 
                                        phases.reduce((sum, p) => sum + (parseFloat(p.spent_amount) || 0), 0)
                                    )}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                                    Funds available in hand
                                </span>
                            </div>
                        </div>

                        {/* Overall Progress & Utilization Bar */}
                        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                <span>Overall Project Budget Utilization</span>
                                <span>
                                    {(() => {
                                        const totalRec = phases.reduce((sum, p) => sum + (parseFloat(p.receivedAmount) || 0), 0);
                                        const totalSp = phases.reduce((sum, p) => sum + (parseFloat(p.spent_amount) || 0), 0);
                                        if (totalRec <= 0) return '0%';
                                        return Math.round((totalSp / totalRec) * 100) + '%';
                                    })()}
                                </span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--surface)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                <div style={{ 
                                    height: '100%', 
                                    width: `${(() => {
                                        const totalRec = phases.reduce((sum, p) => sum + (parseFloat(p.receivedAmount) || 0), 0);
                                        const totalSp = phases.reduce((sum, p) => sum + (parseFloat(p.spent_amount) || 0), 0);
                                        if (totalRec <= 0) return 0;
                                        return Math.min(100, (totalSp / totalRec) * 100);
                                    })()}%`,
                                    background: 'linear-gradient(90deg, var(--primary) 0%, #38bdf8 100%)',
                                    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                            </div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem' }}>
                                💡 Calculated as: Total Spent ({formatCurrency(phases.reduce((sum, p) => sum + (parseFloat(p.spent_amount) || 0), 0))}) / Total Received ({formatCurrency(phases.reduce((sum, p) => sum + (parseFloat(p.receivedAmount) || 0), 0))})
                            </span>
                        </div>
                    </div>
                )}

                {/* Overall Project Dashboard Redirect Button */}
                {!loading && phases.length > 0 && (
                    <button 
                        onClick={() => onSelectPhase(null)}
                        className="glass-panel animate-in"
                        style={{
                            width: '100%',
                            padding: '1.25rem',
                            borderRadius: '16px',
                            background: 'rgba(2, 132, 199, 0.06)',
                            border: '1px solid rgba(2, 132, 199, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            cursor: 'pointer',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            fontSize: '1rem',
                            transition: 'all 0.2s ease',
                            boxShadow: 'var(--shadow-sm)',
                            outline: 'none',
                            marginTop: '0.5rem',
                            marginBottom: '0.5rem'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(2, 132, 199, 0.12)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(2, 132, 199, 0.15)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(2, 132, 199, 0.06)';
                            e.currentTarget.style.borderColor = 'rgba(2, 132, 199, 0.25)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                        }}
                    >
                        <span>📂 All phases</span>
                        <span style={{ fontSize: '1.1rem', transition: 'transform 0.2s' }} className="arrow-icon">➔</span>
                    </button>
                )}

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Syncing phase balances...</span>
                    </div>
                ) : phases.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', borderRadius: '24px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🔖</div>
                        <div>
                            <h3 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.5rem' }}>No Phases Initialized</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '400px' }}>Every project requires at least one tracking phase to establish budget allocation limits and record transaction line entries.</p>
                        </div>
                        {!creating && <button onClick={() => setCreating(true)} className="btn-primary" style={{ padding: '0.75rem 2rem' }}>Initialize First Phase</button>}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                        {phases.map(phase => (
                            <div key={phase.id} className="glass-panel animate-in" style={{ 
                                padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', 
                                border: phase.isSettled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border)', 
                                borderRadius: '24px',
                                boxShadow: phase.isSettled ? '0 10px 30px rgba(16, 185, 129, 0.05)' : '',
                                opacity: deletingId === phase.id ? 0.4 : 1, transition: 'all 0.3s ease'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ 
                                        width: '40px', height: '40px', 
                                        background: phase.isSettled ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-hover)', 
                                        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' 
                                    }}>
                                        {phase.isSettled ? '✅' : '🔖'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {phase.isSettled && (
                                            <span style={{ 
                                                background: 'rgba(16, 185, 129, 0.1)', 
                                                color: '#10b981', 
                                                fontSize: '0.7rem', 
                                                fontWeight: 700, 
                                                padding: '0.25rem 0.6rem', 
                                                borderRadius: '100px', 
                                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}>
                                                Settled
                                            </span>
                                        )}
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <button 
                                                onClick={() => startEdit(phase)} 
                                                title="Edit" 
                                                style={{ 
                                                    padding: '0.4rem', 
                                                    color: 'var(--text-muted)', 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    transition: 'all 0.15s ease',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer'
                                                }} 
                                                onMouseEnter={e => e.currentTarget.style.color='var(--primary)'} 
                                                onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(phase.id, phase.name)} 
                                                title="Delete" 
                                                style={{ 
                                                    padding: '0.4rem', 
                                                    color: 'var(--text-muted)', 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    transition: 'all 0.15s ease',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer'
                                                }} 
                                                onMouseEnter={e => e.currentTarget.style.color='var(--danger)'} 
                                                onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{phase.name}</h3>
                                    {phase.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>{phase.description}</p>}
                                    {phase.requestLetterUrl && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <a 
                                                href={getImageUrl(phase.requestLetterUrl)} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                style={{ 
                                                    fontSize: '0.75rem', 
                                                    color: 'var(--primary)', 
                                                    textDecoration: 'none', 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    gap: '0.25rem',
                                                    fontWeight: 600
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                            >
                                                📎 Request Letter
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div style={{ margin: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Budget</span>
                                        <span style={{ fontWeight: 700 }}>{formatCurrency(phase.estimatedBudget || 0)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--success)' }}>
                                        <span style={{ fontWeight: 600 }}>Received</span>
                                        <span style={{ fontWeight: 800 }}>{formatCurrency(phase.receivedAmount || 0)}</span>
                                    </div>
                                    
                                    {/* Utilization Bar */}
                                    <div style={{ marginTop: '0.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                            <span>{phase.isSettled ? 'Settled' : 'Utilization'}</span>
                                            <span>{(() => {
                                                const received = parseFloat(phase.receivedAmount) || 0;
                                                const spent = parseFloat(phase.spent_amount) || 0;
                                                if (received <= 0) return '0%';
                                                return Math.round((spent / received) * 100) + '%';
                                            })()}</span>
                                        </div>
                                        <div style={{ height: '6px', background: 'var(--surface-hover)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                            <div style={{ 
                                                height: '100%', 
                                                width: `${(() => {
                                                    const received = parseFloat(phase.receivedAmount) || 0;
                                                    const spent = parseFloat(phase.spent_amount) || 0;
                                                    if (received <= 0) return 0;
                                                    return Math.min(100, (spent / received) * 100);
                                                })()}%`,
                                                background: phase.isSettled ? '#10b981' : (parseFloat(phase.spent_amount || 0) > parseFloat(phase.receivedAmount || 0)) ? 'var(--danger)' : 'var(--primary)',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => onSelectPhase(phase)} className="btn-primary" style={{ marginTop: 'auto', width: '100%', padding: '0.8rem' }}>
                                    Open Records <ArrowRight size={16} />
                                </button>
                            </div>
                        ))}

                        {!creating && (
                            <div className="glass-panel" style={{ 
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', 
                                border: '2px dashed var(--border)', borderRadius: '24px', cursor: 'pointer', minHeight: '220px', 
                                transition: 'all 0.2s', color: 'var(--text-muted)'
                            }}
                            onClick={() => setCreating(true)}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = ''; }}>
                                <Plus size={32} />
                                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Create New Phase</span>
                            </div>
                        )}
                    </div>
                )}

                {(creating || editingId) && (
                    <div className="glass-panel animate-in" style={{ padding: '2.5rem', marginTop: '2.5rem', borderRadius: '24px', border: '1px solid var(--primary)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem' }}>{editingId ? 'Edit Phase Details' : 'Initialize New Phase'}</h3>
                        
                        <form onSubmit={editingId ? (e => handleUpdate(e, editingId)) : handleCreate}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.875rem' }}>Phase Name *</label>
                                        <input type="text" value={editingId ? editData.name : newPhase.name} onChange={e => editingId ? setEditData({...editData, name: e.target.value}) : setNewPhase({ ...newPhase, name: e.target.value })} required placeholder="e.g. Foundation, Procurement" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.875rem' }}>Allocated Budget ({symbol})</label>
                                        <input type="number" step="0.01" value={editingId ? editData.estimatedBudget : newPhase.estimatedBudget} onChange={e => editingId ? setEditData({...editData, estimatedBudget: e.target.value}) : setNewPhase({ ...newPhase, estimatedBudget: e.target.value })} placeholder="0.00" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.875rem' }}>Description</label>
                                        <textarea value={editingId ? editData.description : newPhase.description} onChange={e => editingId ? setEditData({...editData, description: e.target.value}) : setNewPhase({ ...newPhase, description: e.target.value })} placeholder="Project stage details..." style={{ minHeight: '100px', marginBottom: editingId ? '1.5rem' : '0' }} />
                                    </div>
                                    {editingId && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                            <input 
                                                type="checkbox" 
                                                id="phase-settled-checkbox"
                                                checked={editData.isSettled} 
                                                onChange={e => setEditData({...editData, isSettled: e.target.checked})}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }} 
                                            />
                                            <div>
                                                <label htmlFor="phase-settled-checkbox" style={{ fontWeight: 700, fontSize: '0.875rem', color: '#10b981', cursor: 'pointer', display: 'block' }}>Mark Phase as Settled</label>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Closes this phase and locks its settled budget status.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>Initial Funding ({symbol})</label>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: '100px' }}>Journal Entry</span>
                                    </div>
                                    
                                    <input type="number" step="0.01" value={editingId ? editData.received_amount : newPhase.received_amount} onChange={e => editingId ? setEditData({...editData, received_amount: e.target.value}) : setNewPhase({...newPhase, received_amount: e.target.value})} placeholder="Amount received..." style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--success)' }} />
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Payment Mode</label>
                                            <select value={editingId ? editData.payment_mode : newPhase.payment_mode} onChange={e => editingId ? setEditData({...editData, payment_mode: e.target.value}) : setNewPhase({...newPhase, payment_mode: e.target.value})}>
                                                <option>Bank Transfer</option>
                                                <option>UPI</option>
                                                <option>Cash</option>
                                                <option>Cheque</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Reference #</label>
                                            <input type="text" placeholder="Tx ID / UTR" value={editingId ? editData.reference : newPhase.reference} onChange={e => editingId ? setEditData({...editData, reference: e.target.value}) : setNewPhase({...newPhase, reference: e.target.value})} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Sender Entity</label>
                                            <input type="text" placeholder="Who sent the funds?" value={editingId ? editData.received_from : newPhase.received_from} onChange={e => editingId ? setEditData({...editData, received_from: e.target.value}) : setNewPhase({...newPhase, received_from: e.target.value})} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Receiver Entity</label>
                                            <input type="text" placeholder="Who received the funds?" value={editingId ? editData.received_to : newPhase.received_to} onChange={e => editingId ? setEditData({...editData, received_to: e.target.value}) : setNewPhase({...newPhase, received_to: e.target.value})} />
                                        </div>
                                        
                                        {/* Request Letter Attachment */}
                                        <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>Request Letter (Optional)</label>
                                            <label style={{
                                                display: 'block', padding: '0.6rem 1rem',
                                                background: 'var(--background)',
                                                border: '1px dashed var(--border)',
                                                borderRadius: '10px', color: 'var(--text-muted)',
                                                fontSize: '0.85rem', fontWeight: 500,
                                                cursor: 'pointer', textAlign: 'center',
                                                transition: 'all 0.2s'
                                            }}>
                                                <input type="file" accept="image/*,.pdf" onChange={e => handleRequestLetterChange(e, !!editingId)}
                                                    disabled={uploadingRequestLetter} style={{ display: 'none' }} />
                                                {uploadingRequestLetter ? '⏳ Uploading...' : (editingId ? editData.request_letter_url : newPhase.request_letter_url) ? '✅ Request Letter Attached' : '📎 Attach Request Letter'}
                                            </label>
                                            {(editingId ? editData.request_letter_url : newPhase.request_letter_url) && (
                                                <a 
                                                    href={getImageUrl(editingId ? editData.request_letter_url : newPhase.request_letter_url)} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    style={{ display: 'block', fontSize: '0.75rem', marginTop: '0.35rem', color: 'var(--primary)', textDecoration: 'underline', textAlign: 'center' }}
                                                >
                                                    View Uploaded Request Letter
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                                <button type="button" onClick={() => { setCreating(false); setEditingId(null); }} style={{ padding: '0.8rem 2rem', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving || uploadingRequestLetter} style={{ padding: '0.8rem 2.5rem', fontSize: '1rem' }}>
                                    {saving ? 'Processing...' : (editingId ? 'Update Phase' : 'Activate Phase')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* Custom Confirmation Dialog */}
            <ConfirmationDialog 
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                cancelText={confirmDialog.cancelText}
                type={confirmDialog.type}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
