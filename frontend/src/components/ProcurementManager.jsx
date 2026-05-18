import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Image, FileText, CheckCircle, Package, Layers, DollarSign, Calendar, Info, Loader2, ArrowRight } from 'lucide-react';
import { procurementApi } from '../services/api';
import { useCurrency } from '../context/SettingsContext';

export default function ProcurementManager({ projectId, activePhase, phasesList, onPrefillExpense }) {
  const { formatCurrency } = useCurrency();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPhaseId, setFilterPhaseId] = useState(activePhase?.id || 'all');
  
  // Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Form Fields
  const [materialName, setMaterialName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('units');
  const [estimatedRate, setEstimatedRate] = useState('');
  const [actualRate, setActualRate] = useState('');
  const [status, setStatus] = useState('PLANNING');
  const [notes, setNotes] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState('');
  const [imageFile, setImageFile] = useState(null);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await procurementApi.list(projectId, filterPhaseId === 'all' ? null : filterPhaseId);
      setItems(data);
    } catch (e) {
      console.error('Failed to load procurement items:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [projectId, filterPhaseId]);

  // Sync component active phase change
  useEffect(() => {
    if (activePhase?.id) {
      setFilterPhaseId(activePhase.id);
    }
  }, [activePhase]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setMaterialName('');
    setVendorName('');
    setQuantity('');
    setUnit('units');
    setEstimatedRate('');
    setActualRate('');
    setStatus('PLANNING');
    setNotes('');
    setSelectedPhaseId(activePhase?.id || '');
    setImageFile(null);
    setFormError('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setMaterialName(item.materialName);
    setVendorName(item.vendorName || '');
    setQuantity(item.quantity.toString());
    setUnit(item.unit);
    setEstimatedRate(item.estimatedRate.toString());
    setActualRate(item.actualRate ? item.actualRate.toString() : '');
    setStatus(item.status);
    setNotes(item.notes || '');
    setSelectedPhaseId(item.phaseId || '');
    setImageFile(null);
    setFormError('');
    setShowFormModal(true);
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this procurement item? This will also permanently delete its photo from your Google Drive.')) return;
    try {
      await procurementApi.delete(projectId, itemId);
      fetchItems();
    } catch (e) {
      alert(e.message || 'Failed to delete item');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!materialName || !quantity || !estimatedRate) {
      setFormError('Please fill in all required fields (Material, Quantity, and Est. Rate)');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      const formData = new FormData();
      formData.append('materialName', materialName);
      formData.append('vendorName', vendorName);
      formData.append('quantity', quantity);
      formData.append('unit', unit);
      formData.append('estimatedRate', estimatedRate);
      formData.append('actualRate', actualRate);
      formData.append('status', status);
      formData.append('notes', notes);
      formData.append('phaseId', selectedPhaseId);
      if (imageFile) {
        formData.append('file', imageFile);
      }

      if (editingItem) {
        await procurementApi.update(projectId, editingItem.id, formData);
      } else {
        await procurementApi.create(projectId, formData);
      }

      setShowFormModal(false);
      fetchItems();
    } catch (err) {
      setFormError(err.message || 'An error occurred during submission.');
    } finally {
      setFormLoading(false);
    }
  };

  // Stats Calculations
  const totalEstimatedCost = items.reduce((sum, item) => sum + (parseFloat(item.estimatedRate) * parseFloat(item.quantity) || 0), 0);
  const totalActualCost = items.reduce((sum, item) => {
    const rate = item.actualRate ? parseFloat(item.actualRate) : parseFloat(item.estimatedRate);
    return sum + (rate * parseFloat(item.quantity) || 0);
  }, 0);
  const activeOrdersCount = items.filter(item => item.status === 'PLANNING' || item.status === 'ORDERED').length;
  const deliveredOrdersCount = items.filter(item => item.status === 'DELIVERED').length;

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Visual Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Package size={28} color="var(--primary)" />
            Procurement & Material Tracker
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Manage delivery photos and invoices stored securely in your Google Drive folder
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select 
            value={filterPhaseId} 
            onChange={(e) => setFilterPhaseId(e.target.value)}
            style={{ 
              padding: '0.6rem 1rem', 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '12px', 
              color: 'var(--text-main)', 
              fontWeight: 600,
              fontSize: '0.85rem',
              outline: 'none'
            }}
          >
            <option value="all">📁 All Phases</option>
            {phasesList.map(p => (
              <option key={p.id} value={p.id}>📂 {p.name}</option>
            ))}
          </select>

          <button onClick={handleOpenAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', borderRadius: '12px', fontWeight: 700 }}>
            <Plus size={16} /> Add Material
          </button>
        </div>
      </div>

      {/* Visual Stats Overview */}
      <div className="responsive-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '20px', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Estimated Budget</span>
            <Layers size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.5rem' }}>
            {formatCurrency(totalEstimatedCost)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            For {items.length} items in pipeline
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '20px', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Delivered / Actual Cost</span>
            <DollarSign size={18} color="var(--success)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.5rem' }}>
            {formatCurrency(totalActualCost)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Actual rate for delivered, estimated for others
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '20px', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Orders</span>
            <Package size={18} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.5rem' }}>
            {activeOrdersCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Planning & Ordered status
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '20px', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Delivered Materials</span>
            <CheckCircle size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.5rem' }}>
            {deliveredOrdersCount} / {items.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Successfully arrived on site
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <Loader2 size={40} className="spin" color="var(--primary)" />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Fetching Google Drive assets...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem 2rem', borderRadius: '24px', textAlign: 'center', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          <Package size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>No Procurement Items Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '380px', margin: '0.5rem auto 1.5rem auto' }}>
            Track materials independently here. All files will be uploaded and stored directly in your private Google Drive.
          </p>
          <button onClick={handleOpenAdd} className="btn-primary" style={{ padding: '0.6rem 1.2rem', borderRadius: '12px' }}>
            Create Your First Item
          </button>
        </div>
      ) : (
        <div className="responsive-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {items.map(item => {
            const itemEst = parseFloat(item.estimatedRate) * parseFloat(item.quantity);
            const itemAct = (item.actualRate ? parseFloat(item.actualRate) : parseFloat(item.estimatedRate)) * parseFloat(item.quantity);
            const hasDriveImage = !!item.driveViewUrl;

            return (
              <div 
                key={item.id} 
                className="glass-panel animate-in" 
                style={{ 
                  borderRadius: '24px', 
                  background: 'var(--glass-bg)', 
                  border: '1px solid var(--border)', 
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  transition: 'transform 0.2s',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Title & Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                        {item.materialName}
                      </h4>
                      {item.vendorName && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vendor: {item.vendorName}</span>
                      )}
                    </div>
                    <span 
                      style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 800, 
                        padding: '0.3rem 0.6rem', 
                        borderRadius: '8px', 
                        letterSpacing: '0.05em',
                        background: 
                          item.status === 'DELIVERED' ? 'rgba(16, 185, 129, 0.15)' :
                          item.status === 'ORDERED' ? 'rgba(245, 158, 11, 0.15)' :
                          item.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: 
                          item.status === 'DELIVERED' ? '#10b981' :
                          item.status === 'ORDERED' ? '#f59e0b' :
                          item.status === 'CANCELLED' ? '#ef4848' : '#3b82f6',
                        border: 
                          item.status === 'DELIVERED' ? '1px solid rgba(16, 185, 129, 0.25)' :
                          item.status === 'ORDERED' ? '1px solid rgba(245, 158, 11, 0.25)' :
                          item.status === 'CANCELLED' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)'
                      }}
                    >
                      {item.status}
                    </span>
                  </div>

                  {/* Quantity & Unit Row */}
                  <div style={{ display: 'flex', gap: '1rem', background: 'var(--surface)', padding: '0.75rem 1rem', borderRadius: '16px', margin: '0.75rem 0', border: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>QUANTITY</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{parseFloat(item.quantity)} {item.unit}</strong>
                    </div>
                    <div style={{ width: '1px', background: 'var(--border)' }} />
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>ESTIMATED RATE</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{formatCurrency(parseFloat(item.estimatedRate))}/{item.unit}</strong>
                    </div>
                    {item.actualRate && (
                      <>
                        <div style={{ width: '1px', background: 'var(--border)' }} />
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>ACTUAL RATE</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--success)' }}>{formatCurrency(parseFloat(item.actualRate))}/{item.unit}</strong>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Google Drive Visual Preview Card */}
                  {hasDriveImage ? (
                    <div 
                      onClick={() => setPreviewImage(item.driveViewUrl)}
                      style={{ 
                        position: 'relative', 
                        height: '140px', 
                        borderRadius: '16px', 
                        overflow: 'hidden', 
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '0.75rem'
                      }}
                    >
                      <img 
                        src={item.driveViewUrl} 
                        alt={item.materialName} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} 
                        onError={(e) => {
                          // Fallback to visual placeholder if direct embed is blocked by user browser
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      {/* Google Drive Badging */}
                      <div style={{ display: 'none', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', padding: '1rem' }}>
                        <Image size={24} color="var(--primary)" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 700, marginTop: '0.25rem' }}>Visual Receipt Attached</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Click to view on Google Drive</span>
                      </div>
                      
                      <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: '0.25rem 0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.55rem', color: '#fff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📁 Google Drive Asset</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      <Info size={14} /> No visual photo attached to this material
                    </div>
                  )}

                  {/* Notes */}
                  {item.notes && (
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      📝 {item.notes}
                    </p>
                  )}
                </div>

                {/* Footer Buttons */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Cost: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(itemAct)}</strong>
                    {itemAct !== itemEst && (
                      <span style={{ display: 'block', fontSize: '0.65rem', color: itemAct > itemEst ? 'var(--danger)' : 'var(--success)' }}>
                        ({itemAct > itemEst ? '+' : ''}{formatCurrency(itemAct - itemEst)} deviation)
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {item.status === 'DELIVERED' && onPrefillExpense && (
                      <button 
                        onClick={() => onPrefillExpense({
                          description: `Procurement: ${item.materialName} (${parseFloat(item.quantity)} ${item.unit})`,
                          amount: itemAct,
                          attachmentUrl: item.driveViewUrl,
                          phaseId: item.phaseId
                        })}
                        className="btn-primary" 
                        style={{ padding: '0.35rem 0.75rem', borderRadius: '10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'linear-gradient(135deg, var(--success) 0%, #059669 100%)', border: 'none', fontWeight: 800 }}
                      >
                        🧾 Book expense
                      </button>
                    )}

                    <button 
                      onClick={() => handleOpenEdit(item)}
                      style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-main)', cursor: 'pointer' }}
                      title="Edit Item"
                    >
                      <Edit3 size={14} />
                    </button>

                    <button 
                      onClick={() => handleDelete(item.id)}
                      style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', cursor: 'pointer' }}
                      title="Delete Item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload/Edit Modal */}
      {showFormModal && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '28px', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 1.25rem 0' }}>
              {editingItem ? '✏️ Edit Procurement Material' : '📦 Add Procurement Material'}
            </h3>

            {formError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: 600 }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Material Name *</label>
                <input 
                  type="text" 
                  value={materialName} 
                  onChange={e => setMaterialName(e.target.value)}
                  placeholder="e.g. Portland Cement, Structural Steel, Brick Bracing"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Vendor Name</label>
                  <input 
                    type="text" 
                    value={vendorName} 
                    onChange={e => setVendorName(e.target.value)}
                    placeholder="e.g. UltraTech, Tata Steel"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Project Phase</label>
                  <select 
                    value={selectedPhaseId} 
                    onChange={e => setSelectedPhaseId(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <option value="">None (Independent)</option>
                    {phasesList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Quantity *</label>
                  <input 
                    type="number" 
                    step="any"
                    value={quantity} 
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="e.g. 50"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Unit Name *</label>
                  <input 
                    type="text" 
                    value={unit} 
                    onChange={e => setUnit(e.target.value)}
                    placeholder="e.g. bags, kg, tons, cft"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Est. Rate / Unit *</label>
                  <input 
                    type="number" 
                    step="any"
                    value={estimatedRate} 
                    onChange={e => setEstimatedRate(e.target.value)}
                    placeholder="Estimated Cost"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Actual Rate / Unit</label>
                  <input 
                    type="number" 
                    step="any"
                    value={actualRate} 
                    onChange={e => setActualRate(e.target.value)}
                    placeholder="If purchased/delivered"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.75rem', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Upload Photo (Google Drive)</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setImageFile(e.target.files[0])}
                    style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Status</label>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    <option value="PLANNING"> PLANNING</option>
                    <option value="ORDERED"> ORDERED</option>
                    <option value="DELIVERED"> DELIVERED</option>
                    <option value="CANCELLED"> CANCELLED</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Material / Delivery Notes</label>
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Include invoice numbers, vehicle details or delivery conditions..."
                  rows={2}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem', resize: 'none' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowFormModal(false)} 
                  className="btn-secondary"
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', fontWeight: 700 }}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', borderRadius: '12px', fontWeight: 700 }}
                  disabled={formLoading}
                >
                  {formLoading ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Uploading to Drive...
                    </>
                  ) : (
                    'Save Material'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div 
          className="modal-backdrop" 
          onClick={() => setPreviewImage(null)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            <img 
              src={previewImage} 
              alt="Google Drive Receipt Preview" 
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
              onError={(e) => {
                alert('Direct rendering is restricted by your Google account cookies. Opening image in a new Google Drive tab.');
                window.open(previewImage, '_blank');
                setPreviewImage(null);
              }}
            />
            <p style={{ textAlign: 'center', color: '#fff', fontSize: '0.8rem', marginTop: '1rem', fontWeight: 600 }}>
              📂 visual asset stored securely inside your private Google Drive
            </p>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                window.open(previewImage, '_blank');
              }}
              className="btn-primary" 
              style={{ display: 'block', margin: '0.5rem auto 0 auto', padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.75rem' }}
            >
              Open File in Drive Tab ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
