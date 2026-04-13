import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { X, Save } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';

export default function EditOverviewModal({ project, phaseObj, onClose, onComplete }) {
    const { symbol, formatCurrency } = useCurrency();
    const isEditingPhase = !!phaseObj;
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [funds, setFunds] = useState('');
    const [receivedPhaseFunds, setReceivedPhaseFunds] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [receivedFunds, setReceivedFunds] = useState(0);
    const [addNewFunds, setAddNewFunds] = useState('');
    const [selectedDepositPhaseId, setSelectedDepositPhaseId] = useState('');

    const fetchReceived = async () => {
        if (!project?.id || isEditingPhase) return;
        try {
            const data = await accountingApi.getJournal(project.id);
            const inflow = data.filter(tx => {
                return tx.lines?.some(l => ['REVENUE', 'LIABILITY', 'EQUITY'].includes(l.account?.type));
            }).reduce((acc, tx) => acc + (parseFloat(tx.lines?.[0]?.amount) || 0), 0);
            setReceivedFunds(inflow);
        } catch (e) {
            console.error("Failed to fetch received funds for modal", e);
        }
    };

    useEffect(() => {
        if (isEditingPhase && phaseObj) {
            setName(phaseObj.name || '');
            setDescription(phaseObj.description || '');
            setFunds(phaseObj.estimatedBudget || '');
            setReceivedPhaseFunds(phaseObj.initial_funding_amount !== undefined ? phaseObj.initial_funding_amount : (phaseObj.received_amount || ''));
        } else if (project) {
            setName(project.name || '');
            setDescription(project.description || '');
            setFunds(project.totalFunds || '');
            setLogoUrl(project.logoUrl || '');
            fetchReceived();
        }
    }, [project, phaseObj, isEditingPhase]);

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingLogo(true);
        try {
            const url = await accountingApi.uploadReceipt(file);
            setLogoUrl(url);
        } catch (err) {
            console.error(err);
            alert("Failed to upload logo.");
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const newFunds = parseFloat(funds) || 0;
            const data = {
                name,
                description,
                [isEditingPhase ? 'estimatedBudget' : 'totalFunds']: newFunds
            };
            
            if (!isEditingPhase) {
                data.logoUrl = logoUrl;
                const updatedProject = await accountingApi.updateProject(project.id, data);

                const addAmt = parseFloat(addNewFunds);
                if (addAmt > 0) {
                    if (!selectedDepositPhaseId) {
                        alert("Please select a phase for the new deposit.");
                        setSaving(false);
                        return;
                    }

                    try {
                        const categories = await accountingApi.listCategories();
                        const assetAcc = categories.find(c => 
                            c.type === 'ASSET' && (c.name.toLowerCase().includes('cash') || c.name.toLowerCase().includes('bank'))
                        ) || categories.find(c => c.type === 'ASSET') || categories[0];
                        
                        const creditAcc = categories.find(c => 
                            (c.type === 'EQUITY' || c.type === 'REVENUE') && (c.name.toLowerCase().includes('fund') || c.name.toLowerCase().includes('grant'))
                        ) || categories.find(c => c.type === 'EQUITY' || c.type === 'REVENUE') || categories[0];

                        if (!assetAcc || !creditAcc) {
                            throw new Error("Could not find suitable accounts (Asset/Equity) to record this transaction.");
                        }

                        const targetPhase = Object.values(project.phases || {}).find(p => p.id === selectedDepositPhaseId);
                        const phaseName = targetPhase ? targetPhase.name : updatedProject.name;

                        await accountingApi.createTransaction({
                            projectId: updatedProject.id,
                            phaseId: selectedDepositPhaseId,
                            date: new Date().toISOString().split('T')[0],
                            description: `Initial/Additional Funding: ${phaseName}`,
                            lines: [
                                { accountId: assetAcc.id, type: 'DEBIT', amount: addAmt },
                                { accountId: creditAcc.id, type: 'CREDIT', amount: addAmt }
                            ]
                        });
                    } catch (txErr) {
                        console.error("Failed to record new funds", txErr);
                        const msg = txErr?.response?.data?.message || txErr?.message || "Unknown Error";
                        alert(`Overview updated, but failed to record the new funds: ${msg}`);
                        return;
                    }
                }
            } else {
                // Attach received amount for phases so the backend can create/update the "Initial Funding" transaction
                data.received_amount = parseFloat(receivedPhaseFunds) || 0;

                // Ensure project.phases is treated as an array (sync with Dashboard logic)
                const phases = Array.isArray(project.phases) ? project.phases : [];
                const otherPhases = phases
                    .filter(ph => ph.id !== phaseObj.id)
                    .map(ph => ph.estimatedBudget || 0);
                
                const sumOthers = otherPhases.reduce((a, b) => a + b, 0);
                const totalRequired = sumOthers + newFunds;
                
                if (totalRequired > (project.totalFunds || 0)) {
                    const confirmMsg = `The total for all phases (₹${totalRequired.toLocaleString()}) exceeds the Project Budget (₹${project.totalFunds?.toLocaleString()}). \n\nIncrease the Project Budget to ₹${totalRequired.toLocaleString()}?`;
                    if (window.confirm(confirmMsg)) {
                        await accountingApi.updateProject(project.id, { totalFunds: totalRequired });
                    }
                }
                
                await accountingApi.updatePhase(project.id, phaseObj.id, data);
            }
            onComplete(name);
        } catch (err) {
            console.error(err);
            const msg = err.status === 403 ? "Permission denied. Admin role required." : 
                        err.response?.data?.detail || err.message || "Failed to save changes.";
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, 
            background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-content glass-panel animate-in" style={{ 
                width: '100%', maxWidth: '850px', padding: 0, 
                background: 'var(--background)', borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Edit {isEditingPhase ? 'Phase' : 'Project'} Overview</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure details and monitor financial health</p>
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ padding: '0.5rem' }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSave} style={{ display: 'flex' }}>
                    {/* Left Column: General Info */}
                    <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRight: '1px solid var(--border)' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {isEditingPhase ? 'Phase Name' : 'Project Name'}
                            </label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Enter name..." />
                        </div>

                        {!isEditingPhase && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: 600 }}>Project Identity (Logo)</label>
                                <div style={{ 
                                    display: 'flex', alignItems: 'center', gap: '1.25rem', p: '1rem',
                                    background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)'
                                }}>
                                    <div style={{ position: 'relative' }}>
                                        {logoUrl ? (
                                            <img src={logoUrl} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '12px' }} />
                                        ) : (
                                            <div style={{ width: '64px', height: '64px', background: 'var(--surface-hover)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No Logo</div>
                                        )}
                                        {uploadingLogo && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'white' }}>...</div>}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} id="logo-upload" style={{ display: 'none' }} />
                                        <label htmlFor="logo-upload" className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-block' }}>
                                            Update Branding
                                        </label>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Square PNG/JPG, Max 2MB</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: 600 }}>Brief Description</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this for?" style={{ minHeight: '120px' }} />
                        </div>
                    </div>

                    {/* Right Column: Financial Snapshot */}
                    <div style={{ width: '340px', padding: '2rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Financial Snapshot</h4>
                        
                        {!isEditingPhase ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border)', background: 'var(--background)' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>ALLOCATED BUDGET</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(funds || 0)}</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.03)' }}>
                                        <div style={{ color: 'var(--success)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.2rem' }}>RECEIVED</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(receivedFunds)}</div>
                                    </div>
                                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.03)' }}>
                                        <div style={{ color: 'var(--warning)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.2rem' }}>PENDING</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--warning)' }}>{formatCurrency(Math.max(0, parseFloat(funds || 0) - receivedFunds))}</div>
                                    </div>
                                </div>

                                <div style={{ 
                                    marginTop: '1rem', padding: '1.25rem', 
                                    background: 'var(--primary)', borderRadius: '16px', color: 'white',
                                    boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.3)'
                                }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>RECORD NEW DEPOSIT</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>+ {symbol}</span>
                                        <input 
                                            type="number" step="0.01" value={addNewFunds} 
                                            onChange={e => setAddNewFunds(e.target.value)} 
                                            placeholder="50,000" 
                                            style={{ 
                                                width: '100%', padding: '0.75rem 1rem 0.75rem 3rem',
                                                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px', color: 'white', fontWeight: 700, outline: 'none'
                                            }}
                                        />
                                    </div>
                                    {parseFloat(addNewFunds) > 0 && (
                                        <div style={{ marginTop: '0.75rem', animation: 'fadeIn 0.2s ease-out' }}>
                                            <select 
                                                value={selectedDepositPhaseId} 
                                                onChange={e => setSelectedDepositPhaseId(e.target.value)}
                                                required
                                                style={{
                                                    width: '100%', padding: '0.6rem 1rem',
                                                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                                    borderRadius: '8px', color: 'white', outline: 'none', fontSize: '0.8rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="" disabled style={{color: 'black'}}>Select Phase...</option>
                                                {Object.values(project?.phases || {}).map(ph => (
                                                    <option key={ph.id} value={ph.id} style={{color: 'black'}}>{ph.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.75rem', fontStyle: 'italic' }}>✓ Direct Journal entry on save</p>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border)', background: 'var(--background)' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ALLOCATED FUNDS</label>
                                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                                        <span style={{ padding: '0.75rem', background: 'var(--surface-hover)', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 800 }}>{symbol}</span>
                                        <input type="number" step="0.01" value={funds} onChange={e => setFunds(e.target.value)} required style={{ width: '100%', padding: '0.75rem', border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none', fontWeight: 700 }} />
                                    </div>
                                </div>
                                
                                <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.03)' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>INITIAL FUNDING RECEIVED</label>
                                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', overflow: 'hidden' }}>
                                        <span style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRight: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--success)', fontWeight: 800 }}>{symbol}</span>
                                        <input type="number" step="0.01" value={receivedPhaseFunds} onChange={e => setReceivedPhaseFunds(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: 'none', background: 'transparent', color: 'var(--success)', outline: 'none', fontWeight: 700 }} placeholder="0.00" />
                                    </div>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>Updates the Phase's Initial Funding ledger entry directly.</p>
                                </div>
                            </div>
                        )}


                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button type="submit" className="btn-primary" disabled={saving} style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                                <Save size={18} /> {saving ? 'Applying...' : 'Save Changes'}
                            </button>
                            <button type="button" onClick={onClose} style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>Discard Changes</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
