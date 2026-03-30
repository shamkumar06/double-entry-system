import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { useCurrency } from '../context/SettingsContext';

export default function TransactionForm({ projectId, phaseId, projectName, phaseName, initialData, onComplete, onCancel }) {
    const { currency } = useCurrency();
    const [categories, setCategories] = useState([]);
    const [phases, setPhases] = useState([]);
    
    // Parse Initial Data into unified fields
    const defaultPaymentMode = initialData?.from_payment_mode?.startsWith('UPI') ? 'UPI' : (initialData?.from_payment_mode || 'Cash');
    const defaultUPIApp = defaultPaymentMode === 'UPI' && initialData?.from_payment_mode?.includes('(') 
        ? initialData.from_payment_mode.match(/\((.*?)\)/)?.[1] || 'GPay'
        : 'GPay';

    const [formData, setFormData] = useState(
        initialData ? {
            project_id: initialData.project_id,
            phase_id: initialData.phase_id || '',
            category_id: initialData.category_id || '',
            project_name: initialData.project_name,
            phase_name: initialData.phase_name || '',
            category_name: initialData.category_name || '',
            amount: initialData.amount || '',
            from_name: initialData.from_name || '',
            to_name: initialData.to_name || '',
            date: initialData.from_date || initialData.transaction_date || new Date().toISOString().slice(0, 16),
            payment_mode: defaultPaymentMode,
            upi_app: defaultUPIApp,
            reference: initialData.from_reference || '',
            description: initialData.description || '',
            receipt_url: initialData.receipt_url || '',
            material_image_url: initialData.material_image_url || ''
        } : {
            project_id: projectId,
            phase_id: phaseId || '',
            category_id: '',
            project_name: projectName,
            phase_name: phaseName || '',
            category_name: '',
            amount: '',
            from_name: '',
            to_name: '',
            date: new Date().toISOString().slice(0, 16),
            payment_mode: 'Cash',
            upi_app: 'GPay',
            reference: '',
            description: '',
            receipt_url: '',
            material_image_url: ''
        }
    );
    const [loading, setLoading] = useState(false);
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [uploadingMaterial, setUploadingMaterial] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    // Load categories from Firebase on mount
    useEffect(() => {
        accountingApi.listCategories()
            .then(data => {
                setCategories(data);
                if (data.length > 0 && !formData.category_id) {
                    setFormData(f => ({ 
                        ...f, 
                        category_id: data[0].code, 
                        category_name: data[0].name 
                    }));
                }
            })
            .catch(() => {
                const defaults = [
                    { code: 5001, name: 'Transport Expense' },
                    { code: 5002, name: 'Food Expense' },
                ];
                setCategories(defaults);
                setFormData(f => ({ ...f, category_id: 5001, category_name: 'Transport Expense' }));
            });

        // Load project phases using logical ID
        accountingApi.listProjects()
            .then(projects => {
                const project = projects.find(p => p.logical_id === projectId);
                if (project && project.phases) {
                    setPhases(Object.values(project.phases));
                }
            })
            .catch(e => console.error("Failed to load phases for form", e));
    }, [projectId]);

    const handleReceiptChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingReceipt(true);
        try {
            const url = await accountingApi.uploadReceipt(file);
            setFormData(f => ({ ...f, receipt_url: url }));
        } catch (err) {
            console.error("Upload error", err);
            alert("Failed to upload bill. " + (err?.response?.data?.detail || err.message));
        } finally {
            setUploadingReceipt(false);
        }
    };

    const handleMaterialChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingMaterial(true);
        try {
            const url = await accountingApi.uploadReceipt(file);
            setFormData(f => ({ ...f, material_image_url: url }));
        } catch (err) {
            console.error("Upload error", err);
            alert("Failed to upload material photo. " + (err?.response?.data?.detail || err.message));
        } finally {
            setUploadingMaterial(false);
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const finalPaymentMode = formData.payment_mode === 'UPI' && formData.upi_app 
                ? `UPI (${formData.upi_app})` 
                : formData.payment_mode;

            const finalReference = formData.payment_mode === 'Cash' ? '' : formData.reference;

            const payload = {
                project_id: formData.project_id,
                phase_id: formData.phase_id,
                category_id: parseInt(formData.category_id),
                project_name: formData.project_name,
                phase_name: formData.phase_name,
                category_name: formData.category_name,
                amount: parseFloat(formData.amount),
                description: formData.description,
                receipt_url: formData.receipt_url,
                material_image_url: formData.material_image_url,
                from_name: formData.from_name,
                from_date: formData.date,
                from_payment_mode: finalPaymentMode,
                from_reference: finalReference,
                to_name: formData.to_name,
                to_date: formData.date,
                to_payment_mode: finalPaymentMode,
                to_reference: finalReference
            };

            if (initialData && initialData.id) {
                await accountingApi.updateTransaction(initialData.id, payload);
            } else {
                await accountingApi.createTransaction(payload);
            }
            if (onComplete) onComplete();
        } catch (error) {
            console.error("Failed to submit transaction", error);
            const detail = error?.response?.data?.detail 
                ? JSON.stringify(error.response.data.detail) 
                : error.message;
            setSubmitError(`Error: ${detail}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '2.5rem', margin: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '2rem' }}>
                    {initialData ? 'Edit Transaction' : 'New Transaction'}
                </h3>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Amount ({currency})</label>
                            <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required placeholder="0.00" />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Account / Category</label>
                            <select 
                                value={formData.category_id} 
                                onChange={e => {
                                    const code = parseInt(e.target.value);
                                    const cat = categories.find(c => c.code === code);
                                    setFormData({...formData, category_id: code, category_name: cat?.name || ''})
                                }}
                            >
                                {categories.length === 0 && <option disabled>Loading categories...</option>}
                                {categories.map(cat => (
                                    <option key={cat.code} value={cat.code}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Phase</label>
                            <select 
                                value={formData.phase_id} 
                                onChange={e => {
                                    const ph_id = e.target.value;
                                    const ph = phases.find(p => p.phase_id === ph_id);
                                    setFormData({...formData, phase_id: ph_id, phase_name: ph?.name || ''})
                                }}
                            >
                                <option value="">-- No Phase (Overall Project) --</option>
                                {phases.map(ph => (
                                    <option key={ph.phase_id} value={ph.phase_id}>{ph.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)' }}>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>Transaction Details</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Date & Time</label>
                                <input type="datetime-local" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Payment Mode</label>
                                <select value={formData.payment_mode} onChange={e => setFormData({...formData, payment_mode: e.target.value})}>
                                    <option value="Cash">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Credit Card">Credit Card</option>
                                </select>
                            </div>
                            
                            {formData.payment_mode === 'UPI' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>UPI App</label>
                                    <select value={formData.upi_app} onChange={e => setFormData({...formData, upi_app: e.target.value})}>
                                        <option value="GPay">Google Pay (GPay)</option>
                                        <option value="PhonePe">PhonePe</option>
                                        <option value="Paytm">Paytm</option>
                                        <option value="Amazon Pay">Amazon Pay</option>
                                        <option value="BHIM">BHIM</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            )}

                            {formData.payment_mode !== 'Cash' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Reference / Txn ID</label>
                                    <input type="text" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} placeholder="Optional Reference" />
                                </div>
                            )}
                        </div>
                    </div>

                    <datalist id="entity-suggestions">
                        <option value="Cash Drawer" />
                        <option value="Main Bank Account" />
                        <option value="Vendor" />
                        <option value="Client" />
                        <option value="Staff / Employee" />
                    </datalist>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div style={{ padding: '1.25rem', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)' }}>
                            <h4 style={{ marginBottom: '1rem', color: 'var(--danger)', fontWeight: 600 }}>Sender (From)</h4>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Name of Person / Entity</label>
                                <input type="text" list="entity-suggestions" value={formData.from_name} onChange={e => setFormData({...formData, from_name: e.target.value})} required placeholder="e.g. John Doe / Bank" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }} />
                            </div>
                        </div>

                        <div style={{ padding: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.05)' }}>
                            <h4 style={{ marginBottom: '1rem', color: 'var(--success)', fontWeight: 600 }}>Receiver (To)</h4>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Name of Person / Entity</label>
                                <input type="text" list="entity-suggestions" value={formData.to_name} onChange={e => setFormData({...formData, to_name: e.target.value})} required placeholder="e.g. Jane Smith / Vendor" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }} />
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Description</label>
                            <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="What was this for?" style={{ width: '100%' }} />
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Receipt / Bill File (Optional)</label>
                            <input type="file" accept="image/*,.pdf" onChange={handleReceiptChange} disabled={uploadingReceipt} style={{ padding: '0.4rem', border: '1px solid var(--border)', borderRadius: '6px', width: '100%', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
                            {uploadingReceipt && <span style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.35rem', display: 'block' }}>Uploading bill securely...</span>}
                            {formData.receipt_url && <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginTop: '0.35rem', display: 'block' }}>✓ Bill Uploaded</span>}
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Procured Material Photo (Optional)</label>
                            <input type="file" accept="image/*" onChange={handleMaterialChange} disabled={uploadingMaterial} style={{ padding: '0.4rem', border: '1px solid var(--border)', borderRadius: '6px', width: '100%', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.85rem' }} />
                            {uploadingMaterial && <span style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.35rem', display: 'block' }}>Uploading photo securely...</span>}
                            {formData.material_image_url && <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginTop: '0.35rem', display: 'block' }}>✓ Photo Uploaded</span>}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {submitError && <span style={{ color: 'var(--danger)', fontSize: '0.85rem', flex: 1 }}>{submitError}</span>}
                        <button type="button" onClick={onCancel} style={{ padding: '0.75rem 1.5rem', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px' }}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={loading || uploadingReceipt || uploadingMaterial}>
                            {loading ? 'Saving...' : 'Save Transaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
