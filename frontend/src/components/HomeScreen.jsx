import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { FolderOpen, Plus, Trash2, ArrowRight, Edit2 } from 'lucide-react';
import { useCurrency } from '../context/SettingsContext';

export default function HomeScreen({ onSelectProject }) {
    const { formatCurrency, currency } = useCurrency();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newProject, setNewProject] = useState({ name: '', description: '', total_funds: '', logo_url: '' });
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ name: '', description: '', total_funds: '', logo_url: '' });

    const fetchProjects = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await accountingApi.listProjects();
            setProjects(data);
        } catch (e) {
            console.error("Failed to load projects", e);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        fetchProjects(); 
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newProject.name.trim()) return;
        setSaving(true);
        try {
            await accountingApi.createProject({
                name: newProject.name.trim(),
                description: newProject.description.trim(),
                total_funds: parseFloat(newProject.total_funds) || 0,
                logo_url: newProject.logo_url
            });
            setNewProject({ name: '', description: '', total_funds: '', logo_url: '' });
            setCreating(false);
            await fetchProjects();
        } catch (e) {
            const detail = e?.response?.data?.detail || e?.message || 'Unknown error';
            alert(`Error creating project: ${detail}`);
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingLogo(true);
        try {
            const url = await accountingApi.uploadReceipt(file);
            setNewProject(prev => ({ ...prev, logo_url: url }));
        } catch (err) {
            console.error(err);
            alert("Failed to upload logo.");
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleEditLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingLogo(true);
        try {
            const url = await accountingApi.uploadReceipt(file);
            setEditData(prev => ({ ...prev, logo_url: url }));
        } catch (err) {
            console.error(err);
            alert("Failed to upload logo.");
        } finally {
            setUploadingLogo(false);
        }
    };

    const startEdit = (project, e) => {
        e.stopPropagation();
        setCreating(false);
        setEditingId(project.id);
        setEditData({
            name: project.name,
            description: project.description || '',
            total_funds: project.total_funds || '',
            logo_url: project.logo_url || ''
        });
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editData.name.trim()) return;
        setSaving(true);
        try {
            await accountingApi.updateProject(editingId, {
                name: editData.name.trim(),
                description: editData.description.trim(),
                total_funds: parseFloat(editData.total_funds) || 0,
                logo_url: editData.logo_url
            });
            setEditingId(null);
            await fetchProjects();
        } catch (err) {
            console.error(err);
            alert("Failed to update project.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name, e) => {
        e.stopPropagation();
        if (!window.confirm(`Delete project "${name}"? This does NOT delete its transactions.`)) return;
        await accountingApi.deleteProject(id);
        setProjects(p => p.filter(pr => pr.id !== id));
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', gap: '2rem' }}>
            {/* Header */}
            <div style={{ textAlign: 'center' }}>
                <h1 className="text-gradient" style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-1px' }}>Double Entry System</h1>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '1.1rem' }}>Select a project to view its financial records</p>
            </div>

            {/* Projects Grid */}
            <div style={{ width: '100%', maxWidth: '900px' }}>
                {loading && !error ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <p style={{ color: 'var(--text-muted)' }}>Loading projects...</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Establishing connection to backend...</p>
                    </div>
                ) : error ? (
                    <div style={{ textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <p style={{ color: 'var(--danger)', fontWeight: 600 }}>Connection failed.</p>
                        <button onClick={fetchProjects} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>Retry Connection</button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                        {projects.map(project => {
                            if (editingId === project.id) {
                                return (
                                    <div key={`edit-${project.id}`} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--primary)' }}>
                                        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Name *</label>
                                                <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} required placeholder="Project Name" style={{ padding: '0.5rem', marginTop: '0.2rem', width: '100%', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                {editData.logo_url ? (
                                                    <img src={editData.logo_url} alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }} />
                                                ) : (
                                                    <div style={{ width: '32px', height: '32px', background: 'var(--surface-hover)', borderRadius: '4px' }} />
                                                )}
                                                <div>
                                                    <input type="file" accept="image/*" onChange={handleEditLogoUpload} disabled={uploadingLogo} id={`edit-logo-${project.id}`} style={{ display: 'none' }} />
                                                    <label htmlFor={`edit-logo-${project.id}`} style={{ padding: '0.3rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.75rem', cursor: uploadingLogo ? 'wait' : 'pointer' }}>
                                                        {uploadingLogo ? '...' : 'Upload Logo'}
                                                    </label>
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Funds ({currency})</label>
                                                <input type="number" step="0.01" value={editData.total_funds} onChange={e => setEditData({...editData, total_funds: e.target.value})} placeholder="0.00" style={{ padding: '0.5rem', marginTop: '0.2rem', width: '100%', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Description</label>
                                                <input type="text" value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})} placeholder="Description" style={{ padding: '0.5rem', marginTop: '0.2rem', width: '100%', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                <button type="button" onClick={() => setEditingId(null)} style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-main)', background: 'transparent' }}>Cancel</button>
                                                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1, padding: '0.5rem' }}>{saving ? '...' : 'Save'}</button>
                                            </div>
                                        </form>
                                    </div>
                                );
                            }

                            return (
                                <div key={project.id} className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                                    onClick={() => onSelectProject(project)}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(79,70,229,0.2)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                                        <button onClick={(e) => startEdit(project, e)} style={{ color: 'var(--text-muted)', padding: '0.25rem' }}
                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={(e) => handleDelete(project.id, project.name, e)} style={{ color: 'var(--text-muted)', padding: '0.25rem' }}
                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
                                        {project.logo_url ? (
                                            <img src={project.logo_url} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '8px' }} />
                                        ) : (
                                            <FolderOpen color="var(--primary)" size={48} />
                                        )}
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{project.name}</h3>
                                    </div>

                                    <div style={{ marginTop: '0.5rem' }}>
                                        {project.description && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', marginBottom: '0.5rem' }}>{project.description}</p>}
                                        <p style={{ color: 'var(--secondary)', fontWeight: 600, fontSize: '0.95rem', textAlign: 'center' }}>
                                            Fund: {formatCurrency(project.total_funds || 0)}
                                        </p>
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                        Open Project <ArrowRight size={14} />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Create new project card */}
                        {!creating && (
                            <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', border: '1px dashed var(--primary)', cursor: 'pointer', minHeight: '180px', transition: 'background 0.2s ease' }}
                                onClick={() => setCreating(true)}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,70,229,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = ''}>
                                <Plus size={36} color="var(--primary)" />
                                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>New Project</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Inline create form */}
                {creating && (
                    <div className="glass-panel" style={{ padding: '2rem', marginTop: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', fontWeight: 600 }}>Create New Project</h3>
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Project Name *</label>
                                    <input type="text" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} required placeholder="e.g. School Building Phase 2" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Project Logo</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {newProject.logo_url ? (
                                            <img src={newProject.logo_url} alt="Logo" style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)' }} />
                                        ) : (
                                            <div style={{ width: '36px', height: '36px', background: 'var(--surface-hover)', borderRadius: '6px', border: '1px solid var(--border)' }} />
                                        )}
                                        <div>
                                            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} id="create-logo-upload" style={{ display: 'none' }} />
                                            <label htmlFor="create-logo-upload" style={{ padding: '0.4rem 0.8rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', cursor: uploadingLogo ? 'wait' : 'pointer', color: 'var(--text-main)', display: 'inline-block' }}>
                                                {uploadingLogo ? 'Uploading...' : 'Upload'}
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Description</label>
                                <input type="text" value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} placeholder="Short description (optional)" />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Funds Allocated ({currency})</label>
                                <input type="number" step="0.01" value={newProject.total_funds} onChange={e => setNewProject({ ...newProject, total_funds: e.target.value })} placeholder="0.00" />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setCreating(false)} style={{ padding: '0.75rem 1.5rem', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Project'}</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
