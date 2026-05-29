import React, { useState, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { accountingApi, getImageUrl } from '../services/api';
import { useCurrency } from '../context/SettingsContext';
import { useProjectData } from '../context/ProjectDataContext';

export default function TransactionForm({ projectId, phaseId, projectName, phaseName, initialData, onComplete, onCancel }) {
    const { currency } = useCurrency();
    const { categories: contextCategories, members } = useProjectData();
    const [categories, setCategories] = useState(contextCategories && contextCategories.length > 0 ? contextCategories : []);
    const [phases, setPhases] = useState([]);
    
    // Extract legacy fields safely if dealing with a strict Node backend payload
    let initialDesc = initialData?.description || '';
    let initialFrom = initialData?.fromEntity || initialData?.from_name || '';
    let initialTo = initialData?.toEntity || initialData?.to_name || '';
    let initialMode = initialData?.paymentMode || initialData?.payment_mode || initialData?.from_payment_mode || '';
    let initialRef = initialData?.reference || initialData?.from_reference || '';

    if (initialData?.description && initialData.description.includes('| From:')) {
        const descString = initialData.description;
        initialDesc = descString.split('|')[0].trim();
        
        const fromMatch = descString.match(/From:\s*(.*?)\s*To:/);
        const toMatch = descString.match(/To:\s*(.*?)\s*(?:\||$)/);
        const modeMatch = descString.match(/Mode:\s*(.*?)\s*(?:Ref:|$)/);
        const refMatch = descString.match(/Ref:\s*(.*)/);

        if (!initialFrom && fromMatch) {
            initialFrom = fromMatch[1].trim() !== '-' ? fromMatch[1].trim() : '';
        }
        if (!initialTo && toMatch) {
            initialTo = toMatch[1].trim() !== '-' ? toMatch[1].trim() : '';
        }
        if (!initialMode && modeMatch) {
            initialMode = modeMatch[1].trim() !== '-' ? modeMatch[1].trim() : '';
        }
        if (!initialRef && refMatch) {
            initialRef = refMatch[1].trim() !== '-' ? refMatch[1].trim() : '';
        }
    }
    
    if (!initialMode) {
        initialMode = 'Cash';
    }
    
    // Find initial default category synchronously on mount using pre-fetched context categories
    const defaultCategory = contextCategories?.find(c => c.type === 'EXPENSE') || contextCategories?.[0];
    const initialCategoryUuid = initialData?.lines?.find(l => !l.account?.name?.toLowerCase().includes('cash') && !l.account?.name?.toLowerCase().includes('bank'))?.accountId || initialData?.category_id || defaultCategory?.id || '';
    const initialCategoryName = defaultCategory?.name || '';
    const initialAmount = initialData?.lines?.[0]?.amount || initialData?.amount || '';
    const initialCgst = initialData?.cgst || '';
    const initialSgst = initialData?.sgst || '';
    const initialIgst = initialData?.igst || '';
    const initialDiscount = initialData?.discount || '';
    const initialActualAmount = initialData?.actualAmount || initialData?.actual_amount || (initialAmount 
        ? (Number(initialAmount) - (Number(initialCgst) || 0) - (Number(initialSgst) || 0) - (Number(initialIgst) || 0) + (Number(initialDiscount) || 0)).toFixed(2)
        : '');

    const defaultPaymentMode = initialMode.startsWith('UPI') ? 'UPI' : initialMode;
    const defaultUPIApp = defaultPaymentMode === 'UPI' && initialMode.includes('(') 
        ? initialMode.match(/\((.*?)\)/)?.[1] || 'GPay'
        : 'GPay';

    const [formData, setFormData] = useState(
        initialData ? {
            project_id: initialData.projectId || initialData.project_id,
            phaseId: initialData.phaseId || initialData.phase?.id || '',
            cashier_name: initialData.cashierName || '',
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
            gpay_screenshot_url: initialData.gpayScreenshotUrl || initialData.gpay_screenshot_url || '',
            material_image_url: initialData.materialImageUrl || initialData.material_image_url || '',
            cgst: initialData.cgst || '',
            sgst: initialData.sgst || '',
            igst: initialData.igst || '',
            discount: initialData.discount || '',
            actual_amount: initialActualAmount
        } : {
            project_id: projectId,
            phaseId: phaseId || '',
            cashier_name: '',
            category_id: initialCategoryUuid,
            category_name: initialCategoryName,
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
            gpay_screenshot_url: '',
            material_image_url: '',
            cgst: '',
            sgst: '',
            igst: '',
            discount: '',
            actual_amount: ''
        }
    );
    const [loading, setLoading] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [uploadingGpay, setUploadingGpay] = useState(false);
    const [uploadingMaterial, setUploadingMaterial] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    // Synchronize or load categories
    useEffect(() => {
        if (contextCategories && contextCategories.length > 0) {
            setCategories(contextCategories);
            
            let matchingCatId = undefined;
            let matchingCatName = undefined;

            if (formData.category_id) {
                const exists = contextCategories.find(c => c.code === parseInt(formData.category_id) || c.id === formData.category_id);
                if (exists) {
                    matchingCatId = exists.id;
                    matchingCatName = exists.name;
                }
            }

            if (matchingCatId) {
                 setFormData(f => ({ ...f, category_id: matchingCatId, category_name: matchingCatName }));
            } else if (contextCategories.length > 0 && !formData.category_id) {
                 const defaultExp = contextCategories.find(c => c.type === 'EXPENSE') || contextCategories[0];
                 setFormData(f => ({ 
                     ...f, 
                     category_id: defaultExp.id, 
                     category_name: defaultExp.name 
                 }));
            }
        } else {
            accountingApi.listCategories()
                .then(data => {
                    setCategories(data);
                    
                    let matchingCatId = undefined;
                    let matchingCatName = undefined;

                    if (formData.category_id) {
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
        }

        // Load project phases using dedicated endpoint
        accountingApi.listPhases(projectId)
            .then(phMap => {
                setPhases(Array.isArray(phMap) ? phMap : Object.values(phMap || {}));
            })
            .catch(e => console.error("Failed to load phases for form", e));
    }, [projectId, contextCategories]);

    // Automatically calculate Total Amount when Actual Amount, GSTs, or Discount changes
    useEffect(() => {
        const actual = parseFloat(formData.actual_amount);
        const cgst = parseFloat(formData.cgst) || 0;
        const sgst = parseFloat(formData.sgst) || 0;
        const igst = parseFloat(formData.igst) || 0;
        const discount = parseFloat(formData.discount) || 0;

        if (!isNaN(actual)) {
            const calculatedTotal = (actual + cgst + sgst + igst - discount);
            setFormData(prev => ({
                ...prev,
                amount: calculatedTotal > 0 ? calculatedTotal.toFixed(2) : '0.00'
            }));
        }
    }, [formData.actual_amount, formData.cgst, formData.sgst, formData.igst, formData.discount]);

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

    const handleGpayChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingGpay(true);
        try {
            const url = await accountingApi.uploadReceipt(file, 'gpay');
            setFormData(f => ({ ...f, gpay_screenshot_url: url }));
        } catch (err) {
            console.error("Upload error", err);
            alert("Failed to upload GPay screenshot. " + (err?.error || err.message));
        } finally {
            setUploadingGpay(false);
        }
    };

    const handleMaterialChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingMaterial(true);
        try {
            const url = await accountingApi.uploadReceipt(file, 'materials');
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
                cashierName: formData.cashier_name || undefined,
                date: formData.date.split('T')[0], // YYYY-MM-DD
                description: formData.description,
                fromEntity: formData.from_name,
                toEntity: formData.to_name,
                paymentMode: finalPaymentMode,
                reference: finalReference,
                attachmentUrl: formData.receipt_url || undefined,
                gpayScreenshotUrl: formData.gpay_screenshot_url || undefined,
                materialImageUrl: formData.material_image_url || undefined,
                cgst: formData.cgst ? Number(formData.cgst) : undefined,
                sgst: formData.sgst ? Number(formData.sgst) : undefined,
                igst: formData.igst ? Number(formData.igst) : undefined,
                discount: formData.discount ? Number(formData.discount) : undefined,
                actualAmount: formData.actual_amount ? Number(formData.actual_amount) : undefined,
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
    const selectedCatType = categories.find(c => c.id === formData.category_id)?.type;
    const selectedCategory = categories.find(c => c.id === formData.category_id);
    const filteredCategories = categories.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="modal-overlay animate-in">
            <div className="glass-panel modal-content">
                {/* Modal Header */}
                <div className="modal-header-container" style={{
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                            {initialData ? '✏️ Edit Transaction' : '+ New Transaction'}
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            All amounts in {currency}. Double-entry will be auto-applied.
                        </p>
                    </div>
                    <button onClick={onCancel} style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'var(--background)', border: '1px solid var(--border)',
                        color: 'var(--text-muted)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s'
                    }}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Row 1: Amount + Account */}
                    <div className="responsive-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Amount ({currency})</label>
                            <input
                                type="number" step="0.01" value={formData.amount}
                                onChange={e => setFormData({...formData, amount: e.target.value})}
                                required placeholder="0.00"
                                style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--primary)'}}
                            />
                        </div>
                            <div style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1.2rem',
                                        borderRadius: '12px',
                                        border: dropdownOpen ? '1px solid var(--primary)' : '1px solid var(--border)',
                                        background: 'var(--input-bg)',
                                        color: 'var(--text-main)',
                                        fontFamily: 'inherit',
                                        fontSize: '0.95rem',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        boxShadow: dropdownOpen ? '0 0 0 4px rgba(56, 189, 248, 0.15)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                                        <span style={{ 
                                            padding: '0.2rem 0.5rem', 
                                            background: selectedCategory?.type === 'EXPENSE' ? 'rgba(239, 68, 68, 0.1)' : 
                                                        selectedCategory?.type === 'REVENUE' ? 'rgba(16, 185, 129, 0.1)' : 
                                                        selectedCategory?.type === 'ASSET' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                            color: selectedCategory?.type === 'EXPENSE' ? 'var(--danger)' : 
                                                   selectedCategory?.type === 'REVENUE' ? 'var(--success)' : 
                                                   selectedCategory?.type === 'ASSET' ? '#3b82f6' : 'var(--text-muted)',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            fontWeight: 800
                                        }}>
                                            {selectedCategory?.type || 'CATEGORY'}
                                        </span>
                                        {selectedCategory?.name || 'Select Category...'}
                                    </span>
                                    <ChevronDown size={18} style={{ 
                                        color: 'var(--text-muted)',
                                        transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s'
                                    }} />
                                </button>

                                {dropdownOpen && (
                                    <>
                                        {/* Fullscreen click-catcher background to close the dropdown */}
                                        <div 
                                            onClick={() => { setDropdownOpen(false); setSearchQuery(''); }}
                                            style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
                                        />

                                        {/* Floating Dropdown Overlay */}
                                        <div className="glass-panel animate-in" style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 8px)',
                                            left: 0,
                                            width: '100%',
                                            maxHeight: '320px',
                                            overflowY: 'auto',
                                            zIndex: 999,
                                            padding: '0.75rem',
                                            borderRadius: '16px',
                                            background: 'var(--surface)',
                                            border: '1px solid var(--border)',
                                            boxShadow: 'var(--shadow-lg)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem'
                                        }}>
                                            {/* Search Input */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-hover)', borderRadius: '10px', padding: '0.4rem 0.8rem', border: '1px solid var(--border)' }}>
                                                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    placeholder="Search categories..."
                                                    style={{
                                                        border: 'none',
                                                        background: 'transparent',
                                                        padding: '0.2rem 0',
                                                        fontSize: '0.85rem',
                                                        outline: 'none',
                                                        boxShadow: 'none',
                                                        width: '100%'
                                                    }}
                                                />
                                            </div>

                                            {/* List of Categories */}
                                            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
                                                {['EXPENSE', 'REVENUE', 'ASSET', 'LIABILITY', 'EQUITY'].map(type => {
                                                    const typeCats = filteredCategories.filter(c => c.type === type);
                                                    if (typeCats.length === 0) return null;
                                                    return (
                                                        <div key={type} style={{ marginBottom: '0.75rem' }}>
                                                            <div style={{ 
                                                                fontSize: '0.65rem', 
                                                                fontWeight: 800, 
                                                                color: type === 'EXPENSE' ? 'var(--danger)' : 
                                                                       type === 'REVENUE' ? 'var(--success)' : 
                                                                       type === 'ASSET' ? '#3b82f6' : 'var(--text-muted)', 
                                                                textTransform: 'uppercase', 
                                                                letterSpacing: '0.1em',
                                                                padding: '0.25rem 0.5rem',
                                                                background: type === 'EXPENSE' ? 'rgba(239, 68, 68, 0.05)' : 
                                                                           type === 'REVENUE' ? 'rgba(16, 185, 129, 0.05)' : 
                                                                           type === 'ASSET' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(100, 116, 139, 0.05)',
                                                                borderRadius: '6px',
                                                                marginBottom: '0.4rem',
                                                                display: 'inline-block'
                                                            }}>
                                                                {type}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                {typeCats.map(cat => {
                                                                    const isSelected = cat.id === formData.category_id;
                                                                    return (
                                                                        <div
                                                                            key={cat.id}
                                                                            onClick={() => {
                                                                                setFormData({...formData, category_id: cat.id, category_name: cat.name});
                                                                                setDropdownOpen(false);
                                                                                setSearchQuery('');
                                                                            }}
                                                                            style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'space-between',
                                                                                padding: '0.6rem 0.75rem',
                                                                                borderRadius: '10px',
                                                                                cursor: 'pointer',
                                                                                background: isSelected ? 'var(--surface-hover)' : 'transparent',
                                                                                color: 'var(--text-main)',
                                                                                fontSize: '0.875rem',
                                                                                fontWeight: isSelected ? 700 : 500,
                                                                                transition: 'all 0.15s ease'
                                                                            }}
                                                                            onMouseEnter={e => {
                                                                                if (!isSelected) {
                                                                                    e.currentTarget.style.background = 'var(--surface-hover)';
                                                                                }
                                                                            }}
                                                                            onMouseLeave={e => {
                                                                                if (!isSelected) {
                                                                                    e.currentTarget.style.background = 'transparent';
                                                                                }
                                                                            }}
                                                                        >
                                                                            <span>{cat.name}</span>
                                                                            {isSelected && <Check size={16} style={{ color: 'var(--primary)' }} />}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {filteredCategories.length === 0 && (
                                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                        No categories match search.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
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
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Transaction Details
                        </p>
                        <div className="responsive-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Date &amp; Time</label>
                                <input type="datetime-local" value={formData.date}
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                    required />
                            </div>
                            <div>
                                <label style={labelStyle}>Payment Mode</label>
                                <select value={formData.payment_mode}
                                    onChange={e => setFormData({...formData, payment_mode: e.target.value})}>
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
                                        onChange={e => setFormData({...formData, upi_app: e.target.value})}>
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
                                        placeholder="Optional" />
                                </div>
                            )}
                            <div>
                                <label style={labelStyle}>Handled By (Cashier)</label>
                                <select value={formData.cashier_name}
                                    onChange={e => setFormData({...formData, cashier_name: e.target.value})}>
                                    <option value="">— Select Cashier —</option>
                                    {(members || []).filter(m => m.isActive !== false).map(m => (
                                        <option key={m.id} value={m.name}>{m.role === 'GUIDE' ? '👑 ' : '🎓 '}{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Sender / Receiver */}
                    <datalist id="entity-suggestions">
                        {selectedCatType === 'ASSET' ? (
                            <>
                                <option value="Main Cash Account" />
                                <option value="Main Bank Account" />
                                {(members || []).filter(m => m.isActive !== false).map(m => (
                                    <option key={m.id} value={m.name} />
                                ))}
                            </>
                        ) : (
                            <>
                                <option value="Cash Drawer" />
                                <option value="Main Bank Account" />
                                <option value="Vendor" />
                                <option value="Client" />
                                <option value="Staff / Employee" />
                            </>
                        )}
                    </datalist>
                    <div className="responsive-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        <div style={{
                            padding: '1.25rem', borderRadius: '16px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ color: 'var(--danger)' }}>↑</span> Sender (From)
                            </p>
                            <label style={labelStyle}>Name / Entity</label>
                            <input type="text" list="entity-suggestions" value={formData.from_name}
                                onChange={e => setFormData({...formData, from_name: e.target.value})}
                                required placeholder="e.g. John / Bank" />
                        </div>
                        <div style={{
                            padding: '1.25rem', borderRadius: '16px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ color: 'var(--success)' }}>↓</span> Receiver (To)
                            </p>
                            <label style={labelStyle}>Name / Entity</label>
                            <input type="text" list="entity-suggestions" value={formData.to_name}
                                onChange={e => setFormData({...formData, to_name: e.target.value})}
                                required placeholder="e.g. Vendor / Jane" />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label style={labelStyle}>Description</label>
                        <textarea rows="2" value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            placeholder="What was this transaction for?"
                            style={{ resize: 'vertical', minHeight: '70px', lineHeight: 1.6 }} />
                    </div>

                    {/* GST and Discount (Only for Expense/Asset) */}
                    {(selectedCatType === 'EXPENSE' || selectedCatType === 'ASSET') && (
                        <div style={{
                            padding: '1.25rem', borderRadius: '16px',
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'
                        }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>Tax & Discount Details (Optional)</p>
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
                                <label style={{ ...labelStyle, color: 'var(--primary)', fontWeight: 700 }}>Actual Amount (Taxable Value / Base Amount)</label>
                                <input type="number" step="0.01" value={formData.actual_amount}
                                    onChange={e => setFormData({...formData, actual_amount: e.target.value})}
                                    placeholder="Amount before tax (e.g. 100.00)"
                                    style={{ fontSize: '1.15rem', fontWeight: 600, border: '1px solid var(--primary)', borderRadius: '10px' }} />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                                    💡 Entering Actual Amount auto-computes Total Gross Amount as: <strong>Actual Amount + CGST + SGST + IGST - Discount</strong>.
                                </span>
                            </div>
                            <div>
                                <label style={labelStyle}>CGST Amount</label>
                                <input type="number" step="0.01" value={formData.cgst}
                                    onChange={e => setFormData({...formData, cgst: e.target.value})}
                                    placeholder="e.g. 9.00" />
                            </div>
                            <div>
                                <label style={labelStyle}>SGST Amount</label>
                                <input type="number" step="0.01" value={formData.sgst}
                                    onChange={e => setFormData({...formData, sgst: e.target.value})}
                                    placeholder="e.g. 9.00" />
                            </div>
                            <div>
                                <label style={labelStyle}>IGST Amount</label>
                                <input type="number" step="0.01" value={formData.igst}
                                    onChange={e => setFormData({...formData, igst: e.target.value})}
                                    placeholder="e.g. 18.00" />
                            </div>
                            <div>
                                <label style={labelStyle}>Discount Amount</label>
                                <input type="number" step="0.01" value={formData.discount}
                                    onChange={e => setFormData({...formData, discount: e.target.value})}
                                    placeholder="e.g. 50.00" />
                            </div>
                        </div>
                    )}

                    {/* Uploads */}
                    <div className="responsive-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label style={labelStyle}>Receipt / Bill (Optional)</label>
                            <label style={uploadLabelStyle}>
                                <input type="file" accept="image/*,.pdf" onChange={handleReceiptChange}
                                    disabled={uploadingReceipt} style={{ display: 'none' }} />
                                {uploadingReceipt ? '⏳ Uploading...' : formData.receipt_url ? '✅ Bill Uploaded' : '📎 Attach Receipt'}
                            </label>
                            {formData.receipt_url && (
                                <div className="premium-hover" style={{ position: 'relative', marginTop: '0.75rem', width: '90px', height: '90px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-hover)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    {formData.receipt_url.toLowerCase().endsWith('.pdf') ? (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '1.5rem' }}>📄</span>
                                            <span style={{ fontWeight: 600 }}>PDF Document</span>
                                        </div>
                                    ) : (
                                        <img src={getImageUrl(formData.receipt_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Receipt" />
                                    )}
                                    <button type="button" onClick={() => setFormData(f => ({ ...f, receipt_url: '' }))} style={{
                                        position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%',
                                        background: 'rgba(239, 68, 68, 0.9)', border: 'none', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                    }} title="Remove attachment">✕</button>
                                </div>
                            )}
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem', textAlign: 'center' }}>
                                💡 Attach invoice PDF or official bill.
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label style={labelStyle}>GPay / UPI screenshot (Optional)</label>
                            <label style={uploadLabelStyle}>
                                <input type="file" accept="image/*" onChange={handleGpayChange}
                                    disabled={uploadingGpay} style={{ display: 'none' }} />
                                {uploadingGpay ? '⏳ Uploading...' : formData.gpay_screenshot_url ? '✅ GPay Screenshot Uploaded' : '📱 Attach GPay / UPI'}
                            </label>
                            {formData.gpay_screenshot_url && (
                                <div className="premium-hover" style={{ position: 'relative', marginTop: '0.75rem', width: '90px', height: '90px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-hover)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <img src={getImageUrl(formData.gpay_screenshot_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="GPay Screenshot" />
                                    <button type="button" onClick={() => setFormData(f => ({ ...f, gpay_screenshot_url: '' }))} style={{
                                        position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%',
                                        background: 'rgba(239, 68, 68, 0.9)', border: 'none', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                    }} title="Remove screenshot">✕</button>
                                </div>
                            )}
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem', textAlign: 'center' }}>
                                💡 Attach payment transaction screenshot.
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label style={labelStyle}>Material Photo (Optional)</label>
                            <label style={uploadLabelStyle}>
                                <input type="file" accept="image/*" onChange={handleMaterialChange}
                                    disabled={uploadingMaterial} style={{ display: 'none' }} />
                                {uploadingMaterial ? '⏳ Uploading...' : formData.material_image_url ? '✅ Photo Uploaded' : '📷 Attach Photo'}
                            </label>
                            {formData.material_image_url && (
                                <div className="premium-hover" style={{ position: 'relative', marginTop: '0.75rem', width: '90px', height: '90px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-hover)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <img src={getImageUrl(formData.material_image_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Material Photo" />
                                    <button type="button" onClick={() => setFormData(f => ({ ...f, material_image_url: '' }))} style={{
                                        position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%',
                                        background: 'rgba(239, 68, 68, 0.9)', border: 'none', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                    }} title="Remove photo">✕</button>
                                </div>
                            )}
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem', textAlign: 'center' }}>
                                💡 Attach delivery or site photo.
                            </span>
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
                            color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer'
                        }}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={loading || uploadingReceipt || uploadingMaterial} style={{
                            padding: '0.8rem 2rem', borderRadius: '12px',
                            background: loading ? 'var(--border)' : 'var(--btn-primary-bg)',
                            color: loading ? 'var(--text-muted)' : 'var(--btn-primary-text)',
                            fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: loading ? 'none' : '0 4px 20px var(--btn-primary-shadow)',
                            transition: 'all 0.2s',
                            border: 'none'
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
    color: 'var(--text-muted)'
};

const uploadLabelStyle = {
    display: 'block', padding: '0.7rem 1rem',
    background: 'var(--background)',
    border: '1px dashed var(--border)',
    borderRadius: '10px', color: 'var(--text-muted)',
    fontSize: '0.85rem', fontWeight: 500,
    cursor: 'pointer', textAlign: 'center',
    transition: 'all 0.2s'
};

