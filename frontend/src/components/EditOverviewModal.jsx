import React, { useState, useEffect } from 'react';
import { accountingApi, getImageUrl } from '../services/api';
import { X, Save } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';

export default function EditOverviewModal({ project, phaseObj, onClose, onComplete }) {
    const { symbol } = useCurrency();
    const isEditingPhase = !!phaseObj;
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [funds, setFunds] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    useEffect(() => {
        if (isEditingPhase && phaseObj) {
            setName(phaseObj.name || '');
            setDescription(phaseObj.description || '');
            setFunds(phaseObj.estimatedBudget || '');
        } else if (project) {
            setName(project.name || '');
            setDescription(project.description || '');
            setFunds(project.totalFunds || '');
            setLogoUrl(project.logoUrl || '');
        }
    }, [project, phaseObj, isEditingPhase]);

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingLogo(true);
        try {
            const url = await accountingApi.uploadReceipt(file, 'logos');
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
                await accountingApi.updateProject(project.id, data);
            } else {
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
                width: '100%', maxWidth: '520px', padding: 0, 
                background: 'var(--background)', borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>Edit {isEditingPhase ? 'Phase' : 'Project'} Overview</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure details and save changes</p>
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ padding: '0.5rem' }}><X size={20} /></button>
                </div>

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Main Content Area */}
                    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                                    display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem',
                                    background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)'
                                }}>
                                    <div style={{ position: 'relative' }}>
                                        {logoUrl ? (
                                            <img src={getImageUrl(logoUrl)} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '12px' }} />
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

                        {/* Budget Input Field (Integrated beautifully) */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                {isEditingPhase ? 'Phase Budget' : 'Project Budget'}
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                                <span style={{ padding: '0.75rem 1rem', background: 'var(--surface-hover)', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 800 }}>{symbol}</span>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={funds} 
                                    onChange={e => setFunds(e.target.value)} 
                                    required 
                                    style={{ width: '100%', padding: '0.75rem', border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none', fontWeight: 700 }} 
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: 600 }}>Brief Description</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this for?" style={{ minHeight: '100px' }} />
                        </div>
                    </div>

                    {/* Footer for action buttons */}
                    <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }}>
                            Discard
                        </button>
                        <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Save size={16} /> {saving ? 'Applying...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
