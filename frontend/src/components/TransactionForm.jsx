import React, { useState, useEffect } from 'react';
import { accountingApi } from '../services/api';
import { useCurrency } from '../context/SettingsContext';

export default function TransactionForm({ projectId, phaseId, projectName, phaseName, initialData, onComplete, onCancel }) {
    const { currency } = useCurrency();
    const [categories, setCategories] = useState([]);
    const [phases, setPhases] = useState([]);
    
    // Extract legacy fields safely if dealing with a strict Node backend payload
    let initialDesc = initialData?.description || '';
    let initialFrom = initialData?.from_name || '';
    let initialTo = initialData?.to_name || '';
    let initialMode = initialData?.from_payment_mode || 'Cash';
    let initialRef = initialData?.from_reference || '';

    if (initialData?.description && initialData.description.includes('| From:')) {
        const parts = initialData.description.split('|');
        initialDesc = parts[0]?.trim();
        
        const fromToMatch = parts[1]?.match(/From: (.*?) To: (.*)/);
        if (fromToMatch) {
            initialFrom = fromToMatch[1]?.trim() !== '-' ? fromToMatch[1]?.trim() : '';
            initialTo = fromToMatch[2]?.trim() !== '-' ? fromToMatch[2]?.trim() : '';
        }
        
        const modeRefMatch = parts[2]?.match(/Mode: (.*?) Ref: (.*)/);
        if (modeRefMatch) {
            initialMode = modeRefMatch[1]?.trim() !== '-' ? modeRefMatch[1]?.trim() : 'Cash';
            initialRef = modeRefMatch[2]?.trim() !== '-' ? modeRefMatch[2]?.trim() : '';
        }
    }
    
    // Extract actual numeric amount and category UUID from strict lines array
    const initialAmount = initialData?.lines?.[0]?.amount || initialData?.amount || '';
    const initialCategoryUuid = initialData?.lines?.find(l => !l.account?.name?.toLowerCase().includes('cash') && !l.account?.name?.toLowerCase().includes('bank'))?.accountId || initialData?.category_id || '';

    const defaultPaymentMode = initialMode.startsWith('UPI') ? 'UPI' : initialMode;
    const defaultUPIApp = defaultPaymentMode === 'UPI' && initialMode.includes('(') 
        ? initialMode.match(/\((.*?)\)/)?.[1] || 'GPay'
        : 'GPay';

    const [formData, setFormData] = useState(
        initialData ? {
            project_id: initialData.projectId || initialData.project_id,
            phaseId: initialData.phaseId || initialData.phase?.id || '',
            category_id: initialCategoryUuid,
            project_name: initialData.project?.name || initialData.project_name,
            phase_name: initialData.phase?.name || initialData.phase_name || '',
            amount: initialAmount,
            from_name: initialFrom,
            to_name: initialTo,
            date: initialData.date ? new Date(initialData.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
            payment_mode: defaultPaymentMode,
            upi_app: defaultUPIApp,
            reference: initialRef,
            description: initialDesc,
            receipt_url: initialData.attachmentUrl || initialData.receipt_url || '',
            material_image_url: initialData.material_image_url || ''
        } : {
            project_id: projectId,
            phaseId: phaseId || '',
            category_id: '',
            project_name: projectName,
            phase_name: phaseName || '',
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
                
                let matchingCatId = undefined;
                let matchingCatName = undefined;

                if (formData.category_id) {
                    // Force upgrade legacy numeric codes to formal string UUIDs on edit
                    const exists = data.find(c => c.code === parseInt(formData.category_id) || c.id === formData.category_id);
                    if (exists) {
                        matchingCatId = exists.id;
                        matchingCatName = exists.name;
                    }
                }

                if (matchingCatId) {
                     setFormData(f => ({ ...f, category_id: matchingCatId, category_name: matchingCatName }));
                } else if (data.length > 0 && !formData.category_id) {
                     const defaultExp = data.find(c => c.type === 'EXPENSE') || data[0];
                     setFormData(f => ({ 
                         ...f, 
                         category_id: defaultExp.id, 
                         category_name: defaultExp.name 
                     }));
                }
            })
            .catch(() => {
                const defaults = [
                    { id: 'offline-5001', code: 5001, name: 'Transport Expense', type: 'EXPENSE' },
                    { id: 'offline-5002', code: 5002, name: 'Food Expense', type: 'EXPENSE' },
                ];
                setCategories(defaults);
                setFormData(f => ({ ...f, category_id: defaults[0].id, category_name: 'Transport Expense' }));
            });

        // Load project phases using dedicated endpoint
        accountingApi.listPhases(projectId)
            .then(phMap => {
                setPhases(Array.isArray(phMap) ? phMap : Object.values(phMap || {}));
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
            alert("Failed to upload bill. " + (err?.error || err.message));
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
            alert("Failed to upload material photo. " + (err?.error || err.message));
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

            // Construct the enriched description from legacy python fields
            const enrichedDescription = `${formData.description} | From: ${formData.from_name} To: ${formData.to_name} | Mode: ${finalPaymentMode} Ref: ${finalReference}`;

            // Try to find a Cash/Bank account to use as the offsetting balance.
            const cashAccount = categories.find(c => c.name.toLowerCase().includes('cash') || c.name.toLowerCase().includes('bank')) || categories[0];
            const primaryAccountId = formData.category_id;
            const primaryCategory = categories.find(c => c.id === primaryAccountId);

            // Double Entry Mapping: If it's an Expense, debit it. If Income, credit it.
            let lines = [];
            const amt = parseFloat(formData.amount);
            
            if (primaryCategory?.type === 'REVENUE' || primaryCategory?.type === 'LIABILITY') {
                lines.push({ accountId: cashAccount.id, type: 'DEBIT', amount: amt });
                lines.push({ accountId: primaryAccountId, type: 'CREDIT', amount: amt });
            } else {
                lines.push({ accountId: primaryAccountId, type: 'DEBIT', amount: amt });
                lines.push({ accountId: cashAccount.id, type: 'CREDIT', amount: amt });
            }

            const payload = {
                projectId: formData.project_id,
                date: formData.date.split('T')[0], // YYYY-MM-DD
                description: enrichedDescription,
                attachmentUrl: formData.receipt_url || formData.material_image_url || undefined,
                lines: lines
            };

            if (formData.phaseId) {
                payload.phaseId = formData.phaseId;
            }

            if (initialData && initialData.id) {
                await accountingApi.updateTransaction(initialData.id, payload);
            } else {
                await accountingApi.createTransaction(payload);
            }
            if (onComplete) onComplete();
        } catch (error) {
            console.error("Failed to submit transaction", error);
            const detail = error?.error 
                ? (typeof error.error === 'object' ? JSON.stringify(error.error) : error.error) 
                : error.message;
            setSubmitError(`Error: ${detail}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(10, 15, 30, 0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem'
        }}>
            <div style={{
                width: '100%', maxWidth: '660px',
                maxHeight: '92vh', overflowY: 'auto',
                background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                color: '#f1f5f9'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '2rem 2rem 1.5rem',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#f1f5f9' }}>
                            {initialData ? '✏️ Edit Transaction' : '+ New Transaction'}
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>
                            All amounts in {currency}. Double-entry will be auto-applied.
                        </p>
                    </div>
                    <button onClick={onCancel} style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#94a3b8', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s'
                    }}>✕</button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.75rem 2rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Row 1: Amount + Account */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Amount ({currency})</label>
                            <input
                                type="number" step="0.01" value={formData.amount}
                                onChange={e => setFormData({...formData, amount: e.target.value})}
                                required placeholder="0.00"
                                style={{...inputStyle, fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.01em', color: '#f1f5f9'}}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Account / Category</label>
                            <select
                                value={formData.category_id}
                                onChange={e => {
                                    const uuid = e.target.value;
                                    const cat = categories.find(c => c.id === uuid);
                                    setFormData({...formData, category_id: uuid, category_name: cat?.name || ''})
                                }}
                                style={selectStyle}
                            >
                                {categories.length === 0 && <option disabled>Loading...</option>}
                                {['EXPENSE', 'REVENUE', 'ASSET', 'LIABILITY', 'EQUITY'].map(type => {
                                    const typeCats = categories.filter(c => c.type === type);
                                    if (typeCats.length === 0) return null;
                                    return (
                                        <optgroup key={type} label={type} style={{ background: '#0f172a', color: '#94a3b8' }}>
                                            {typeCats.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </optgroup>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Phase */}
                    <div>
                        <label style={labelStyle}>Phase</label>
                        <select
                            value={formData.phaseId}
                            onChange={e => {
                                const ph_id = e.target.value;
                                const ph = phases.find(p => p.id === ph_id);
                                setFormData({...formData, phaseId: ph_id, phase_name: ph?.name || ''})
                            }}
                            style={selectStyle}
                        >
                            <option value="">— No Phase (Whole Project) —</option>
                            {phases.map(ph => (
                                <option key={ph.id} value={ph.id}>{ph.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Transaction Details */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '16px', padding: '1.25rem'
                    }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: '1rem' }}>
                            Transaction Details
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Date &amp; Time</label>
                                <input type="datetime-local" value={formData.date}
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                    required style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Payment Mode</label>
                                <select value={formData.payment_mode}
                                    onChange={e => setFormData({...formData, payment_mode: e.target.value})}
                                    style={selectStyle}>
                                    <option value="Cash">💵 Cash</option>
                                    <option value="UPI">📱 UPI</option>
                                    <option value="Bank Transfer">🏦 Bank Transfer</option>
                                    <option value="Credit Card">💳 Credit Card</option>
                                </select>
                            </div>
                            {formData.payment_mode === 'UPI' && (
                                <div>
                                    <label style={labelStyle}>UPI App</label>
                                    <select value={formData.upi_app}
                                        onChange={e => setFormData({...formData, upi_app: e.target.value})}
                                        style={selectStyle}>
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
                                    <label style={labelStyle}>Reference / Txn ID</label>
                                    <input type="text" value={formData.reference}
                                        onChange={e => setFormData({...formData, reference: e.target.value})}
                                        placeholder="Optional" style={inputStyle} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sender / Receiver */}
                    <datalist id="entity-suggestions">
                        <option value="Cash Drawer" />
                        <option value="Main Bank Account" />
                        <option value="Vendor" /><option value="Client" />
                        <option value="Staff / Employee" />
                    </datalist>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{
                            padding: '1.25rem', borderRadius: '16px',
                            background: 'rgba(239,68,68,0.06)',
                            border: '1px solid rgba(239,68,68,0.2)'
                        }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444', marginBottom: '0.75rem' }}>
                                ↑ Sender (From)
                            </p>
                            <label style={labelStyle}>Name / Entity</label>
                            <input type="text" list="entity-suggestions" value={formData.from_name}
                                onChange={e => setFormData({...formData, from_name: e.target.value})}
                                required placeholder="e.g. John / Bank"
                                style={{...inputStyle, borderColor: 'rgba(239,68,68,0.25)'}} />
                        </div>
                        <div style={{
                            padding: '1.25rem', borderRadius: '16px',
                            background: 'rgba(16,185,129,0.06)',
                            border: '1px solid rgba(16,185,129,0.2)'
                        }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#10b981', marginBottom: '0.75rem' }}>
                                ↓ Receiver (To)
                            </p>
                            <label style={labelStyle}>Name / Entity</label>
                            <input type="text" list="entity-suggestions" value={formData.to_name}
                                onChange={e => setFormData({...formData, to_name: e.target.value})}
                                required placeholder="e.g. Vendor / Jane"
                                style={{...inputStyle, borderColor: 'rgba(16,185,129,0.25)'}} />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label style={labelStyle}>Description</label>
                        <textarea rows="2" value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            placeholder="What was this transaction for?"
                            style={{...inputStyle, resize: 'vertical', minHeight: '70px', lineHeight: 1.6}} />
                    </div>

                    {/* Uploads */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Receipt / Bill (Optional)</label>
                            <label style={uploadLabelStyle}>
                                <input type="file" accept="image/*,.pdf" onChange={handleReceiptChange}
                                    disabled={uploadingReceipt} style={{ display: 'none' }} />
                                {uploadingReceipt ? '⏳ Uploading...' : formData.receipt_url ? '✅ Bill Uploaded' : '📎 Attach Receipt'}
                            </label>
                        </div>
                        <div>
                            <label style={labelStyle}>Material Photo (Optional)</label>
                            <label style={uploadLabelStyle}>
                                <input type="file" accept="image/*" onChange={handleMaterialChange}
                                    disabled={uploadingMaterial} style={{ display: 'none' }} />
                                {uploadingMaterial ? '⏳ Uploading...' : formData.material_image_url ? '✅ Photo Uploaded' : '📷 Attach Photo'}
                            </label>
                        </div>
                    </div>

                    {/* Error + Actions */}
                    {submitError && (
                        <div style={{
                            padding: '0.75rem 1rem', borderRadius: '10px',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#ef4444', fontSize: '0.85rem'
                        }}>
                            {submitError}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button type="button" onClick={onCancel} style={{
                            padding: '0.8rem 1.5rem', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#94a3b8', fontWeight: 600, cursor: 'pointer'
                        }}>Cancel</button>
                        <button type="submit" disabled={loading || uploadingReceipt || uploadingMaterial} style={{
                            padding: '0.8rem 2rem', borderRadius: '12px',
                            background: loading ? '#1e293b' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: '1px solid rgba(59,130,246,0.4)',
                            color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: loading ? 'none' : '0 4px 20px rgba(59,130,246,0.35)',
                            transition: 'all 0.2s'
                        }}>
                            {loading ? 'Saving...' : initialData ? 'Update Transaction' : 'Save Transaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Shared inline style tokens ─────────────────────────────────────────────
const labelStyle = {
    display: 'block', marginBottom: '0.4rem',
    fontSize: '0.75rem', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    color: '#475569'
};

const inputStyle = {
    width: '100%', padding: '0.7rem 0.9rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#e2e8f0',
    fontSize: '0.92rem', outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit'
};

const selectStyle = {
    width: '100%', padding: '0.7rem 0.9rem',
    background: '#1e293b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#e2e8f0',
    fontSize: '0.92rem', outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
    cursor: 'pointer',
    appearance: 'auto'
};

const uploadLabelStyle = {
    display: 'block', padding: '0.7rem 1rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.15)',
    borderRadius: '10px', color: '#64748b',
    fontSize: '0.85rem', fontWeight: 500,
    cursor: 'pointer', textAlign: 'center',
    transition: 'all 0.2s'
};

