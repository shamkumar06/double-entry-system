import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { Settings, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

const ACCOUNT_TYPES = ['Expense', 'Asset', 'Liability', 'Revenue', 'Equity'];

export default function CategoryManager({ onRename }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('Expense');
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [isSavingRename, setIsSavingRename] = useState(false);

    const fetchCategories = async () => {
        try {
            const data = await accountingApi.listCategories();
            setCategories(data);
        } catch (e) {
            console.error("Failed to load categories", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCategories(); }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const created = await accountingApi.createCategory({ name: newName.trim(), account_type: newType });
            setCategories(prev => [...prev, created]);
            setNewName('');
        } catch (err) {
            alert(err?.response?.data?.detail || "Error adding category");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this category?")) return;
        setDeletingId(id);
        try {
            await accountingApi.deleteCategory(id);
            setCategories(prev => prev.filter(c => c.id !== id));
        } catch (e) {
            alert("Error deleting category");
        } finally {
            setDeletingId(null);
        }
    };

    const handleRename = async (id) => {
        const oldCat = categories.find(c => c.id === id);
        if (!oldCat || !editingName.trim()) return;
        const oldName = oldCat.name;
        const newName = editingName.trim();
        
        setIsSavingRename(true);
        try {
            await accountingApi.renameCategory(id, newName);
            setCategories(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
            setEditingId(null);
            if (onRename) onRename(oldName, newName);
        } catch (e) {
            alert("Error renaming category");
        } finally {
            setIsSavingRename(false);
        }
    };

    // Group categories by type
    const grouped = categories.reduce((acc, cat) => {
        const type = cat.account_type || 'Expense';
        if (!acc[type]) acc[type] = [];
        acc[type].push(cat);
        return acc;
    }, {});

    const typeColors = { Expense: '#ef4444', Asset: '#10b981', Liability: '#f59e0b', Revenue: '#818cf8', Equity: '#c084fc' };

    return (
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <Settings color="var(--primary)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Account Categories</h3>
            </div>

            {/* Add new category */}
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Category Name</label>
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Labour, Materials, Office..." required />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Type</label>
                    <select value={newType} onChange={e => setNewType(e.target.value)}>
                        {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', whiteSpace: 'nowrap' }}>
                    <Plus size={16} /> {saving ? 'Adding...' : 'Add Category'}
                </button>
            </form>

            {/* Categories list grouped by type */}
            {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading categories...</p>
            ) : categories.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No categories yet. Add one above.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {Object.entries(grouped).map(([type, cats]) => (
                        <div key={type}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: typeColors[type] || '#94a3b8' }} />
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{type}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                {cats.map(cat => (
                                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                        {editingId === cat.id ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <input
                                                    value={editingName}
                                                    onChange={e => setEditingName(e.target.value)}
                                                    autoFocus
                                                    style={{ height: '1.5rem', fontSize: '0.875rem', padding: '0.2rem', width: '120px' }}
                                                />
                                                <button onClick={() => handleRename(cat.id)} disabled={isSavingRename} style={{ color: 'var(--success)' }}>
                                                    <Check size={14} />
                                                </button>
                                                <button onClick={() => setEditingId(null)} style={{ color: 'var(--danger)' }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span style={{ fontSize: '0.875rem' }}>{cat.name}</span>
                                                <div style={{ display: 'flex', gap: '0.2rem' }}>
                                                    <button onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                                                        style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
                                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button onClick={() => handleDelete(cat.id)} disabled={deletingId === cat.id}
                                                        style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
                                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
