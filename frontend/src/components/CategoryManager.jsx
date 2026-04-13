import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { Settings, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

const ACCOUNT_TYPES = ['Expense', 'Asset', 'Liability', 'Revenue', 'Equity'];

export default function CategoryManager({ onRename, userRole }) {
    const isAdmin = userRole === 'ADMIN';
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('Expense');
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [isSavingRename, setIsSavingRenaming] = useState(false);
    const [error, setError] = useState(null);

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

    const getMaxCode = () => {
        if (categories.length === 0) return 1000;
        return Math.max(...categories.map(c => c.code || 0)) + 1;
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const code = getMaxCode();
            const type = newType.toUpperCase();
            const created = await accountingApi.createCategory({ 
                name: newName.trim(), 
                type, 
                code,
                description: `Manual category: ${newName.trim()}`
            });
            setCategories(prev => [...prev, created]);
            setNewName('');
        } catch (err) {
            console.error("Add category error:", err);
            const msg = err.error?.[0]?.message || err.message || "Error adding category";
            setError(msg);
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const cat = categories.find(c => c.id === id);
        if (cat?.isSystem) {
            alert("System categories cannot be deleted.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete "${cat?.name}"?`)) return;
        
        setDeletingId(id);
        setError(null);
        try {
            await accountingApi.deleteCategory(id);
            setCategories(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            console.error("Delete category error:", err);
            const msg = err.status === 403 ? "Permission denied or System category." : 
                        (err.message?.includes('foreign key') || err.status === 500) ? 
                        "Cannot delete: This category is being used in transactions." :
                        "Error deleting category";
            setError(msg);
            alert(msg);
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
        const typeOrig = cat.type || 'EXPENSE';
        // Normalize back to title case for UI grouping labels
        const type = typeOrig.charAt(0) + typeOrig.slice(1).toLowerCase();
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
                {isAdmin ? (
                    <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <Plus size={16} /> {saving ? 'Adding...' : 'Add Category'}
                    </button>
                ) : (
                    <div className="glass-panel" style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Admin Only
                    </div>
                )}
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
                                    <div key={cat.id} style={{ 
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                        padding: '0.5rem 0.75rem', borderRadius: '8px', 
                                        background: 'var(--surface)', border: '1px solid var(--border)',
                                        opacity: cat.isSystem ? 0.8 : 1
                                    }}>
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
                                                    {!cat.isSystem && isAdmin && (
                                                        <>
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
                                                        </>
                                                    )}
                                                    {cat.isSystem && (
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: '4px' }}>SYSTEM</span>
                                                    )}
                                                    {!isAdmin && !cat.isSystem && (
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: '4px' }}>RESTRICTED</span>
                                                    )}
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
            {/* ── Accounting Reference Guide ─────────────────────────────────── */}
            <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📖</span>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Accounting Reference Guide — Which type to use?</h4>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
                                {['Type', 'Normal Balance', 'Increases with', 'Decreases with', 'Common Examples', 'Use when…'].map(h => (
                                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                {
                                    type: 'Asset',
                                    color: '#10b981',
                                    normalBalance: 'DEBIT ←',
                                    increases: 'Debit',
                                    decreases: 'Credit',
                                    examples: 'Cash, Bank, Equipment, Land',
                                    use: 'Recording something you own or is owed to you',
                                },
                                {
                                    type: 'Expense',
                                    color: '#ef4444',
                                    normalBalance: 'DEBIT ←',
                                    increases: 'Debit',
                                    decreases: 'Credit',
                                    examples: 'Labour, Materials, Fuel, Rent, Utilities',
                                    use: 'You spend money on something that is consumed (project cost)',
                                },
                                {
                                    type: 'Liability',
                                    color: '#f59e0b',
                                    normalBalance: 'CREDIT →',
                                    increases: 'Credit',
                                    decreases: 'Debit',
                                    examples: 'Loans Payable, Creditors',
                                    use: 'You owe money to someone else',
                                },
                                {
                                    type: 'Revenue',
                                    color: '#818cf8',
                                    normalBalance: 'CREDIT →',
                                    increases: 'Credit',
                                    decreases: 'Debit',
                                    examples: 'Grants Received, Contract Income',
                                    use: 'Money received as income / project funding',
                                },
                                {
                                    type: 'Equity',
                                    color: '#c084fc',
                                    normalBalance: 'CREDIT →',
                                    increases: 'Credit',
                                    decreases: 'Debit',
                                    examples: 'Retained Earnings, Owner Capital',
                                    use: 'Net worth / initial capital injected into the project',
                                },
                            ].map((row, i) => (
                                <tr key={row.type} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--surface)'}>
                                    <td style={{ padding: '0.875rem 1rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                                            {row.type}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.875rem 1rem' }}>
                                        <span style={{ fontWeight: 700, color: row.normalBalance.startsWith('D') ? 'var(--primary)' : 'var(--accent)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {row.normalBalance}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.875rem 1rem', color: row.increases === 'Debit' ? 'var(--primary)' : 'var(--accent)', fontWeight: 600 }}>
                                        {row.increases}
                                    </td>
                                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>
                                        {row.decreases}
                                    </td>
                                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', maxWidth: 200 }}>
                                        {row.examples}
                                    </td>
                                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                        {row.use}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Quick visual mnemonic */}
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {[
                        { label: '💸 Spending money (expense)', entry: 'DR Expense  |  CR Cash/Bank' },
                        { label: '💰 Receiving funds', entry: 'DR Cash/Bank  |  CR Revenue/Equity' },
                        { label: '🏗️ Buying equipment', entry: 'DR Equipment (Asset)  |  CR Cash/Bank' },
                        { label: '🤝 Taking a loan', entry: 'DR Cash/Bank  |  CR Loan (Liability)' },
                    ].map(tip => (
                        <div key={tip.label} style={{ flex: '1 1 240px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.875rem 1rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.3rem' }}>{tip.label}</div>
                            <code style={{ fontSize: '0.75rem', color: 'var(--accent)', letterSpacing: '0.02em' }}>{tip.entry}</code>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
