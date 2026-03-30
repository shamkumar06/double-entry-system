import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { GitBranch, Plus, Trash2, ArrowRight, ChevronLeft, Edit2 } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';

export default function PhaseSelector({ project, onSelectPhase, onBack }) {
    const { formatCurrency, currency } = useCurrency();
    const [phases, setPhases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newPhase, setNewPhase] = useState({ 
        name: '', description: '', allocated_funds: '',
        received_amount: '',
        received_from: '', received_to: '',
        payment_mode: 'Bank Transfer', reference: ''
    });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ 
        name: '', description: '', allocated_funds: '',
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
        if (!project?.id) {
            alert("Error: project ID is missing. Please go back and reopen the project.");
            return;
        }
        setSaving(true);
        try {
            const newAlloc = parseFloat(newPhase.allocated_funds) || 0;
            const currentTotalAlloc = phases.reduce((acc, ph) => acc + (ph.allocated_funds || 0), 0);
            const totalRequired = currentTotalAlloc + newAlloc;

            // SMART BUDGET GUARD: Check if this new phase pushes the project over-limit
            if (totalRequired > (project.total_funds || 0)) {
                const confirmMsg = `This new phase pushes the total allocation (₹${totalRequired.toLocaleString()}) above the Project Budget (₹${project.total_funds?.toLocaleString()}). \n\nIncrease Project Budget to ₹${totalRequired.toLocaleString()}?`;
                if (window.confirm(confirmMsg)) {
                    await accountingApi.updateProject(project.id, { total_funds: totalRequired });
                }
            }

            const receivedAmt = parseFloat(newPhase.received_amount) || 0;
            await accountingApi.createPhase(project.id, {
                ...newPhase,
                name: newPhase.name.trim(),
                description: newPhase.description.trim(),
                allocated_funds: newAlloc,
                received_amount: receivedAmt,
                is_received: receivedAmt > 0
            });
            setNewPhase({ 
                name: '', description: '', allocated_funds: '',
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
            const newAlloc = parseFloat(editData.allocated_funds) || 0;
            const otherPhasesAlloc = phases
                .filter(ph => ph.id !== phaseId)
                .reduce((acc, ph) => acc + (ph.allocated_funds || 0), 0);
            
            const totalRequired = otherPhasesAlloc + newAlloc;

            // SMART BUDGET GUARD
            if (totalRequired > (project.total_funds || 0)) {
                const confirmMsg = `Updating this phase pushes the total allocation (₹${totalRequired.toLocaleString()}) above the Project Budget (₹${project.total_funds?.toLocaleString()}). \n\nIncrease Project Budget to ₹${totalRequired.toLocaleString()}?`;
                if (window.confirm(confirmMsg)) {
                    await accountingApi.updateProject(project.id, { total_funds: totalRequired });
                }
            }

            const receivedAmt = parseFloat(editData.received_amount) || 0;
            await accountingApi.updatePhase(project.id, phaseId, {
                ...editData,
                name: editData.name.trim(),
                description: editData.description.trim(),
                allocated_funds: newAlloc,
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
            allocated_funds: phase.allocated_funds || '',
            received_amount: phase.received_amount || '',
            received_from: phase.received_from || '',
            received_to: phase.received_to || '',
            payment_mode: phase.payment_mode || 'Bank Transfer',
            reference: phase.reference || ''
        });
    };

    const handleDelete = async (phaseId, phaseName) => {
        if (!window.confirm(`Delete "${phaseName}"? This won't delete its transactions.`)) return;
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
            
            {/* Header */}
            <div style={{ textAlign: 'center', width: '100%', maxWidth: '820px' }}>
                <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                    <ChevronLeft size={16} /> Back to Projects
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    {project.logo_url ? (
                        <img src={project.logo_url} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '6px' }} />
                    ) : (
                        <GitBranch size={28} color="var(--primary)" />
                    )}
                    <h1 className="text-gradient" style={{ fontSize: '2.5rem', fontWeight: 800 }}>{project.name}</h1>
                </div>
                <p style={{ color: 'var(--text-muted)' }}>Select or create a phase to view its financial records</p>
            </div>

            {/* Phases grid */}
            <div style={{ width: '100%', maxWidth: '820px' }}>
                {/* "All Phases" shortcut card */}
                <div className="glass-panel" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid rgba(79,70,229,0.25)', transition: 'all 0.2s' }}
                    onClick={() => onSelectPhase(null)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,70,229,0.08)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = 'rgba(79,70,229,0.25)'; }}>
                    <div>
                        <p style={{ fontWeight: 600, fontSize: '1.05rem' }}>📊 All Phases</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>View combined records across all phases</p>
                    </div>
                    <ArrowRight size={20} color="var(--primary)" />
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading phases...</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
                        {phases.map(phase => (
                            editingId === phase.id ? (
                                <div key={`edit-${phase.id}`} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--primary)' }}>
                                    <form onSubmit={(e) => handleUpdate(e, phase.id)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Name</label>
                                            <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} required placeholder="Phase Name" style={{ padding: '0.5rem', marginTop: '0.2rem' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Budget Allocated ({currency})</label>
                                            <input type="number" step="0.01" value={editData.allocated_funds} onChange={e => setEditData({...editData, allocated_funds: e.target.value})} placeholder="0.00" style={{ padding: '0.5rem', marginTop: '0.2rem' }} />
                                        </div>
                                         <div>
                                             <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Description</label>
                                             <input type="text" value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} placeholder="Description" style={{ padding: '0.5rem', marginTop: '0.2rem' }} />
                                         </div>
                                         
                                         <div style={{ padding: '0.75rem', background: 'rgba(79,70,229,0.05)', borderRadius: '8px', border: '1px solid rgba(79,70,229,0.1)' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>Received Amount ({currency})</label>
                                            <input type="number" step="0.01" min="0" placeholder="0.00" value={editData.received_amount} onChange={e => setEditData({...editData, received_amount: e.target.value})} style={{ padding: '0.45rem', marginBottom: '0.75rem', width: '100%' }} />
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                <input type="text" placeholder="From (Sender)" value={editData.received_from} onChange={e => setEditData({...editData, received_from: e.target.value})} style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                                                <input type="text" placeholder="To (Receiver)" value={editData.received_to} onChange={e => setEditData({...editData, received_to: e.target.value})} style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                                                <select value={editData.payment_mode} onChange={e => setEditData({...editData, payment_mode: e.target.value})} style={{ fontSize: '0.8rem', padding: '0.4rem' }}>
                                                    <option>Bank Transfer</option>
                                                    <option>Cash</option>
                                                    <option>Cheque</option>
                                                </select>
                                                <input type="text" placeholder="Reference #" value={editData.reference} onChange={e => setEditData({...editData, reference: e.target.value})} style={{ fontSize: '0.8rem', padding: '0.4rem' }} />
                                            </div>
                                         </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button type="button" onClick={() => setEditingId(null)} style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-main)' }}>Cancel</button>
                                            <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1, padding: '0.5rem' }}>{saving ? '...' : 'Save'}</button>
                                        </div>
                                    </form>
                                </div>
                            ) : (
                                <div key={phase.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: deletingId === phase.id ? 0.4 : 1, transition: 'all 0.2s ease' }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(79,70,229,0.15)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '1.75rem' }}>🔖</span>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => startEdit(phase)} style={{ color: 'var(--text-muted)', padding: '0.25rem' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                                <Edit2 size={15} />
                                            </button>
                                            <button onClick={() => handleDelete(phase.id, phase.name)} style={{ color: 'var(--text-muted)', padding: '0.25rem' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                <div>
                                    <p style={{ fontWeight: 600, fontSize: '1.05rem' }}>{phase.name}</p>
                                    {phase.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{phase.description}</p>}
                                    
                                    <div style={{ marginTop: '0.8rem', padding: '0.4rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                Estimated Budget: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{formatCurrency(phase.allocated_funds || 0)}</span>
                                            </p>
                                            {(phase.received_amount > phase.allocated_funds) && (
                                                <span title="Surplus Received" style={{ color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                     Surplus
                                                </span>
                                            )}
                                        </div>
                                        
                                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: 600 }}>
                                            Received: {formatCurrency(phase.received_amount || 0)}
                                        </p>

                                        {/* Utilization Bar */}
                                        <div style={{ marginTop: '0.2rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                <span>Utilization</span>
                                                <span>{Math.round((((phase.allocated_funds || 0) - (phase.remaining_balance || 0)) / (phase.allocated_funds || 1)) * 100)}%</span>
                                            </div>
                                            <div style={{ height: '6px', background: 'var(--surface-hover)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                <div style={{ 
                                                    height: '100%', 
                                                    width: `${Math.min(100, (((phase.allocated_funds || 0) - (phase.remaining_balance || 0)) / (phase.allocated_funds || 1)) * 100)}%`,
                                                    background: (((phase.allocated_funds || 0) - (phase.remaining_balance || 0)) > (phase.allocated_funds || 0)) ? 'var(--danger)' : 'var(--primary)',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <p style={{ 
                                                fontSize: '0.7rem', 
                                                fontWeight: 700, 
                                                color: phase.is_received ? 'var(--success)' : 'var(--warning)',
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                background: phase.is_received ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                                border: '1px solid ' + (phase.is_received ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)')
                                            }}>
                                                {phase.is_received ? '✓ RECEIVED' : '⏳ PENDING'}
                                            </p>
                                            {phase.is_settled && (
                                                <p style={{ 
                                                    fontSize: '0.7rem', 
                                                    fontWeight: 700, 
                                                    color: '#fff',
                                                    display: 'inline-block',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    background: 'var(--primary)',
                                                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
                                                }}>
                                                    ✓ SETTLED
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button className="btn-primary" onClick={() => onSelectPhase(phase)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    Open Phase <ArrowRight size={14} />
                                </button>
                            </div>
                            )
                        ))}

                        {/* Add Phase card */}
                        {!creating && (
                            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', border: '1px dashed var(--primary)', cursor: 'pointer', minHeight: '160px', transition: 'background 0.2s' }}
                                onClick={() => setCreating(true)}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,70,229,0.07)'}
                                onMouseLeave={e => e.currentTarget.style.background = ''}>
                                <Plus size={30} color="var(--primary)" />
                                <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.9rem' }}>Add Phase</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Inline create phase form */}
                {creating && (
                    <div className="glass-panel" style={{ padding: '1.75rem', marginTop: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', fontWeight: 600 }}>New Phase</h3>
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Phase Name *</label>
                                    <input type="text" value={newPhase.name} onChange={e => setNewPhase({ ...newPhase, name: e.target.value })} required placeholder="e.g. Phase 1, Foundation Work" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Budget Allocated ({currency})</label>
                                    <input type="number" step="0.01" value={newPhase.allocated_funds} onChange={e => setNewPhase({ ...newPhase, allocated_funds: e.target.value })} placeholder="0.00" />
                                </div>
                            </div>
                             <div>
                                 <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Description</label>
                                 <input type="text" value={newPhase.description} onChange={e => setNewPhase({ ...newPhase, description: e.target.value })} placeholder="Optional description" />
                             </div>

                              <div style={{ padding: '1rem', background: 'rgba(79,70,229,0.05)', borderRadius: '12px', border: '1px solid rgba(79,70,229,0.1)' }}>
                                 <div style={{ marginBottom: '1rem' }}>
                                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <label style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>Received Amount ({currency})</label>
                                        {(parseFloat(newPhase.received_amount) > parseFloat(newPhase.allocated_funds)) && (
                                            <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>⚠️ Exceeds Budget</span>
                                        )}
                                     </div>
                                     <input type="number" step="0.01" min="0" value={newPhase.received_amount} onChange={e => setNewPhase({...newPhase, received_amount: e.target.value})} placeholder="0.00 (leave blank if not received yet)" />
                                 </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Received From</label>
                                        <input type="text" placeholder="e.g. SRM IST College" value={newPhase.received_from} onChange={e => setNewPhase({...newPhase, received_from: e.target.value})} style={{ marginTop: '0.25rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Received To</label>
                                        <input type="text" placeholder="e.g. SAE Baja Account" value={newPhase.received_to} onChange={e => setNewPhase({...newPhase, received_to: e.target.value})} style={{ marginTop: '0.25rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment Mode</label>
                                        <select value={newPhase.payment_mode} onChange={e => setNewPhase({...newPhase, payment_mode: e.target.value})} style={{ marginTop: '0.25rem' }}>
                                            <option>Bank Transfer</option>
                                            <option>Cash</option>
                                            <option>Cheque</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reference / Tx ID</label>
                                        <input type="text" placeholder="UTR #, Receipt #" value={newPhase.reference} onChange={e => setNewPhase({...newPhase, reference: e.target.value})} style={{ marginTop: '0.25rem' }} />
                                    </div>
                                </div>
                             </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setCreating(false)} style={{ padding: '0.75rem 1.5rem', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Phase'}</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
