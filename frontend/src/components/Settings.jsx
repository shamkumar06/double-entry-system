import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { User, DollarSign, Save, Calendar, ArrowUpDown, FileText, Layers, CheckCircle, XCircle } from 'lucide-react';
import { accountingApi } from '../services/api';

export default function Settings({ activeProject, onUpdate }) {
    const { settings, updateSettings, updateProfile } = useSettings();
    const [profile, setProfile] = useState({ ...settings.profile });
    const [saved, setSaved] = useState(false);

    const handleSaveProfile = (e) => {
        e.preventDefault();
        updateProfile(profile);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const toggleReportSection = (section) => {
        updateSettings({
            reportSections: {
                ...settings.reportSections,
                [section]: !settings.reportSections[section]
            }
        });
    };

    const handleToggleSettlement = async (phaseId, phaseName, currentStatus) => {
        const action = currentStatus ? "Unsettle" : "Settle";
        const msg = currentStatus 
            ? `Are you sure you want to unsettle "${phaseName}"? This will DELETE the settlement transaction and restore its previous balance.`
            : `Are you sure you want to settle "${phaseName}"? This will create a balancing transaction and mark it as closed.`;
            
        if (!window.confirm(msg)) return;
        
        try {
            await accountingApi.updatePhase(activeProject.id, phaseId, { is_settled: !currentStatus });
            if (onUpdate) onUpdate();
            alert(`Phase "${phaseName}" successfully ${currentStatus ? 'unsettled' : 'settled'}.`);
        } catch (e) {
            alert("Action failed: " + (e.response?.data?.detail || e.message));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '750px', paddingBottom: '3rem' }}>

            {/* ── Phase Management (New) ── */}
            {activeProject && (
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ color: 'var(--primary)', background: 'rgba(99,102,241,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                            <Layers size={20} />
                        </div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Phase Management</h3>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                        Manage the settlement status of phases for <strong>{activeProject.name}</strong>. Settled phases are read-only and balances are cleared.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {Object.entries(activeProject.phases || {}).map(([phId, ph]) => (
                            <div key={phId} style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                padding: '1rem', borderRadius: '12px', background: 'var(--surface)',
                                border: ph.is_settled ? '1px solid var(--success)' : '1px solid var(--border)'
                            }}>
                                <div>
                                    <p style={{ fontWeight: 600 }}>{ph.name}</p>
                                    <p style={{ fontSize: '0.75rem', color: ph.is_settled ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {ph.is_settled ? 'Status: SETTLED (Balanced)' : 'Status: ACTIVE (Open)'}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleToggleSettlement(phId, ph.name, ph.is_settled)}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                                        cursor: 'pointer', border: '1px solid currentColor',
                                        background: 'transparent',
                                        color: ph.is_settled ? 'var(--primary)' : 'var(--success)',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.background = ph.is_settled ? 'var(--primary)' : 'var(--success)';
                                        e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = ph.is_settled ? 'var(--primary)' : 'var(--success)';
                                    }}
                                >
                                    {ph.is_settled ? <XCircle size={16} /> : <CheckCircle size={16} />}
                                    {ph.is_settled ? 'Unsettle Phase' : 'Settle Phase'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Display Preferences ── */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ color: 'var(--secondary)', background: 'rgba(16,185,129,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                        <Calendar size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Display Preferences</h3>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Date Format</label>
                        <select
                            value={settings.dateFormat}
                            onChange={e => updateSettings({ dateFormat: e.target.value })}
                        >
                            <option value="YYYY-MM-DD">YYYY-MM-DD (Standard)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (Common)</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Default View Order</label>
                        <select
                            value={settings.sortOrder}
                            onChange={e => updateSettings({ sortOrder: e.target.value })}
                        >
                            <option value="Descending">Newest First (Descending)</option>
                            <option value="Ascending">Oldest First (Ascending)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Currency Format ── */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ color: 'var(--primary)', background: 'rgba(79,70,229,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                        <DollarSign size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Currency Format</h3>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <select
                        value={settings.currency}
                        onChange={e => updateSettings({ currency: e.target.value })}
                        style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '1rem', minWidth: '220px' }}
                    >
                        {Object.keys(settings.rates || { 'INR': 1 }).sort().map(code => (
                            <option key={code} value={code}>
                                {code} (Rate: {(settings.rates?.[code] || 1).toFixed(4)})
                            </option>
                        ))}
                    </select>

                    <button 
                        onClick={async () => {
                            try {
                                const res = await fetch('https://open.er-api.com/v6/latest/INR');
                                const data = await res.json();
                                if (data.result === 'success' && data.rates) {
                                    updateSettings({ rates: data.rates });
                                    alert(`Successfully fetched live currency rates.`);
                                }
                            } catch (err) { alert("Network error while fetching rates."); }
                        }}
                        className="btn-secondary"
                        style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }}
                    >
                        🔄 Fetch Live Rates
                    </button>
                </div>
            </div>

            {/* ── Profile ── */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                        <User size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Report Profile (Header Info)</h3>
                </div>
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Full Name</label>
                            <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="Your name" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Organization</label>
                            <input type="text" value={profile.organization} onChange={e => setProfile({ ...profile, organization: e.target.value })} placeholder="Firm name" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Save size={16} /> {saved ? '✓ Saved!' : 'Update Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
