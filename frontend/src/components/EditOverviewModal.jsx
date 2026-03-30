import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
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
            setFunds(phaseObj.allocated_funds || '');
        } else if (project) {
            setName(project.name || '');
            setDescription(project.description || '');
            setFunds(project.total_funds || '');
            setLogoUrl(project.logo_url || '');
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
                [isEditingPhase ? 'allocated_funds' : 'total_funds']: newFunds
            };
            
            if (!isEditingPhase) {
                data.logo_url = logoUrl;
                await accountingApi.updateProject(project.id, data);
            } else {
                // SMART BUDGET GUARD: Check if this phase pushes the project over-limit
                const otherPhases = Object.entries(project.phases || {})
                    .filter(([id, ph]) => id !== phaseObj.id)
                    .map(([id, ph]) => ph.allocated_funds || 0);
                
                const sumOthers = otherPhases.reduce((a, b) => a + b, 0);
                const totalRequired = sumOthers + newFunds;
                
                if (totalRequired > (project.total_funds || 0)) {
                    const confirmMsg = `The total for all phases (₹${totalRequired.toLocaleString()}) exceeds the Project Budget (₹${project.total_funds?.toLocaleString()}). \n\nIncrease the Project Budget to ₹${totalRequired.toLocaleString()}?`;
                    if (window.confirm(confirmMsg)) {
                        await accountingApi.updateProject(project.id, { total_funds: totalRequired });
                    }
                }
                
                await accountingApi.updatePhase(project.id, phaseObj.id, data);
            }
            onComplete(name); // Pass new name back to update active state
        } catch (err) {
            console.error(err);
            alert("Failed to save changes. " + (err.response?.data?.detail || ""));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-content glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '450px', background: 'var(--background)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Edit {isEditingPhase ? 'Phase Summary' : 'Project Overview'}</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem' }}>{isEditingPhase ? 'Phase Name' : 'Project Name'}</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', outline: 'none' }} />
                    </div>
                    {!isEditingPhase && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem' }}>Project Logo</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)' }} />
                                ) : (
                                    <div style={{ width: '48px', height: '48px', background: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                )}
                                <div>
                                    <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} id="logo-upload" style={{ display: 'none' }} />
                                    <label htmlFor="logo-upload" style={{ padding: '0.5rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.85rem', cursor: uploadingLogo ? 'wait' : 'pointer', color: 'var(--text-main)', display: 'inline-block' }}>
                                        {uploadingLogo ? 'Uploading...' : 'Upload Image'}
                                    </label>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Recommended: Square PNG/JPG</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem' }}>Description (Optional)</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', minHeight: '80px', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem' }}>{isEditingPhase ? 'Allocated Funds' : 'Total Funds'}</label>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                            <span style={{ padding: '0.6rem', background: 'var(--surface-hover)', borderRight: '1px solid var(--border)', color: 'var(--text-muted)' }}>{symbol}</span>
                            <input type="number" step="0.01" value={funds} onChange={e => setFunds(e.target.value)} required style={{ width: '100%', padding: '0.6rem', border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.75rem' }}>
                        <button type="button" onClick={onClose} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
