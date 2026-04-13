import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { GitBranch, Plus, Trash2, ArrowRight, ChevronLeft, Edit2 } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';

export default function PhaseSelector({ project, onSelectPhase, onBack }) {
    const { formatCurrency, symbol } = useCurrency();
    const [phases, setPhases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newPhase, setNewPhase] = useState({ 
        name: '', description: '', estimatedBudget: '',
        received_amount: '',
        received_from: '', received_to: '',
        payment_mode: 'Bank Transfer', reference: ''
    });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ 
        name: '', description: '', estimatedBudget: '',
        received_amount: '',
        received_from: '', received_to: '',
        payment_mode: '', reference: ''
    });

    const fetchPhases = async () => {
        setLoading(true);
        try {
            const data = await accountingApi.listPhases(project.id);
            setPhases(data);
        } catch (e) {
            console.error("Failed to load phases", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPhases(); }, [project.id]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newPhase.name.trim()) return;
        setSaving(true);
        try {
            const newAlloc = parseFloat(newPhase.estimatedBudget) || 0;
            const currentTotalAlloc = phases.reduce((acc, ph) => acc + (ph.estimatedBudget || 0), 0);
            const totalRequired = currentTotalAlloc + newAlloc;

            if (totalRequired > (project.totalFunds || 0)) {
                const confirmMsg = `This new phase pushes the total allocation (₹${totalRequired.toLocaleString()}) above the Project Budget (₹${project.totalFunds?.toLocaleString()}). \n\nIncrease Project Budget to ₹${totalRequired.toLocaleString()}?`;
                if (window.confirm(confirmMsg)) {
                    await accountingApi.updateProject(project.id, { totalFunds: totalRequired });
                }
            }

            const receivedAmt = parseFloat(newPhase.received_amount) || 0;
            await accountingApi.createPhase(project.id, {
                ...newPhase,
                name: newPhase.name.trim(),
                description: newPhase.description.trim(),
                estimatedBudget: newAlloc,
                received_amount: receivedAmt,
                is_received: receivedAmt > 0
            });
            setNewPhase({ 
                name: '', description: '', estimatedBudget: '',
                received_amount: '',
                received_from: '', received_to: '',
                payment_mode: 'Bank Transfer', reference: ''
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

    const handleUpdate = async (e, phaseId) => {
        e.preventDefault();
        if (!editData.name.trim()) return;
        setSaving(true);
        try {
            const newAlloc = parseFloat(editData.estimatedBudget) || 0;
            const otherPhasesAlloc = phases
                .filter(ph => ph.id !== phaseId)
                .reduce((acc, ph) => acc + (ph.estimatedBudget || 0), 0);
            
            const totalRequired = otherPhasesAlloc + newAlloc;

            if (totalRequired > (project.totalFunds || 0)) {
                const confirmMsg = `Updating this phase pushes the total allocation (₹${totalRequired.toLocaleString()}) above the Project Budget (₹${project.totalFunds?.toLocaleString()}). \n\nIncrease Project Budget to ₹${totalRequired.toLocaleString()}?`;
                if (window.confirm(confirmMsg)) {
                    await accountingApi.updateProject(project.id, { totalFunds: totalRequired });
                }
            }

            const receivedAmt = parseFloat(editData.received_amount) || 0;
            await accountingApi.updatePhase(project.id, phaseId, {
                ...editData,
                name: editData.name.trim(),
                description: editData.description.trim(),
                estimatedBudget: newAlloc,
                received_amount: receivedAmt,
                is_received: receivedAmt > 0
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

    const startEdit = (phase) => {
        setCreating(false);
        setEditingId(phase.id);
        setEditData({
            name: phase.name,
            description: phase.description || '',
            estimatedBudget: phase.estimatedBudget || '',
            received_amount: phase.initial_funding_amount !== undefined ? phase.initial_funding_amount : (phase.received_amount || ''),
            received_from: phase.received_from || '',
            received_to: phase.received_to || '',
            payment_mode: phase.payment_mode || 'Bank Transfer',
            reference: phase.reference || ''
        });
    };

    const handleDelete = async (phaseId, phaseName) => {
        if (!window.confirm(`Delete "${phaseName}"? All transactions in this phase will be moved to the Recycle Bin.`)) return;
        setDeletingId(phaseId);
        try {
            await accountingApi.deletePhase(project.id, phaseId);
            setPhases(p => p.filter(ph => ph.id !== phaseId));
        } catch {
            alert("Error deleting phase");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', gap: '2rem', background: 'var(--background)' }}>
            
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '820px' }}>
                <button onClick={onBack} className="btn-icon" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                    <ChevronLeft size={16} /> Back to Projects
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    {project.logoUrl ? (
                        <img src={project.logoUrl} alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--border)' }} />
                    ) : (
                        <div style={{ width: '48px', height: '48px', background: 'var(--surface)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                            <GitBranch size={24} color="var(--primary)" />
                        </div>
                    )}
                    <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 800 }}>{project.name}</h1>
                </div>
                <p style={{ color: 'var(--text-muted)' }}>Select or create a phase to manage financial records</p>
            </div>

            <div style={{ width: '100%', maxWidth: '820px' }}>
                <div className="glass-panel" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid rgba(2, 132, 199, 0.2)', transition: 'all 0.2s', borderRadius: '20px' }}
                    onClick={() => onSelectPhase(null)}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = ''}>
                    <div>
                        <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>📊 Project Financial Overview</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>View combined analytics across all phases</p>
                    </div>
                    <ArrowRight size={20} color="var(--primary)" />
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                        <p style={{ color: 'var(--text-muted)' }}>Loading phases...</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                        {phases.map(phase => (
                            <div key={phase.id} className="glass-panel animate-in" style={{ 
                                padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', 
                                border: '1px solid var(--border)', borderRadius: '24px',
                                opacity: deletingId === phase.id ? 0.4 : 1, transition: 'all 0.3s ease'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ width: '40px', height: '40px', background: 'var(--surface-hover)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🔖</div>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button onClick={() => startEdit(phase)} className="btn-icon" style={{ padding: '0.4rem' }}><Edit2 size={14} /></button>
                                        <button onClick={() => handleDelete(phase.id, phase.name)} title="Delete" style={{ padding: '0.4rem', color: 'var(--text-muted)' }} onMouseEnter={e => e.currentTarget.style.color='var(--danger)'} onMouseLeave={e => e.currentTarget.style.color='var(--text-muted)'}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{phase.name}</h3>
                                    {phase.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>{phase.description}</p>}
                                </div>

                                <div style={{ margin: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Budget</span>
                                        <span style={{ fontWeight: 700 }}>{formatCurrency(phase.estimatedBudget || 0)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--success)' }}>
                                        <span style={{ fontWeight: 600 }}>Received</span>
                                        <span style={{ fontWeight: 800 }}>{formatCurrency(phase.received_amount || 0)}</span>
                                    </div>
                                    
                                    {/* Utilization Bar */}
                                    <div style={{ marginTop: '0.2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                            <span>Utilization</span>
                                            <span>{(() => {
                                                const received = parseFloat(phase.received_amount) || 0;
                                                const spent = parseFloat(phase.spent_amount) || 0;
                                                if (received <= 0) return '0%';
                                                return Math.round((spent / received) * 100) + '%';
                                            })()}</span>
                                        </div>
                                        <div style={{ height: '6px', background: 'var(--surface-hover)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                            <div style={{ 
                                                height: '100%', 
                                                width: `${(() => {
                                                    const received = parseFloat(phase.received_amount) || 0;
                                                    const spent = parseFloat(phase.spent_amount) || 0;
                                                    if (received <= 0) return 0;
                                                    return Math.min(100, (spent / received) * 100);
                                                })()}%`,
                                                background: (parseFloat(phase.spent_amount || 0) > parseFloat(phase.received_amount || 0)) ? 'var(--danger)' : 'var(--primary)',
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
                                        <textarea value={editingId ? editData.description : newPhase.description} onChange={e => editingId ? setEditData({...editData, description: e.target.value}) : setNewPhase({ ...newPhase, description: e.target.value })} placeholder="Project stage details..." style={{ minHeight: '100px' }} />
                                    </div>
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
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                                <button type="button" onClick={() => { setCreating(false); setEditingId(null); }} style={{ padding: '0.8rem 2rem', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.8rem 2.5rem', fontSize: '1rem' }}>
                                    {saving ? 'Processing...' : (editingId ? 'Update Phase' : 'Activate Phase')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
