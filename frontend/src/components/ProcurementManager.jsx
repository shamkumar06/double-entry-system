import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit3, Image, FileText, CheckCircle, Package, Layers, DollarSign, Calendar, Info, Loader2, ArrowRight, FolderOpen } from 'lucide-react';
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
  const [imageFiles, setImageFiles] = useState([]);

  // Tax and Discount States
  const [cgst, setCgst] = useState('');
  const [sgst, setSgst] = useState('');
  const [igst, setIgst] = useState('');
  const [discount, setDiscount] = useState('');


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
    setImageFiles([]);
    setCgst('');
    setSgst('');
    setIgst('');
    setDiscount('');
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
    setImageFiles([]);
    setCgst(item.cgst ? item.cgst.toString() : '');
    setSgst(item.sgst ? item.sgst.toString() : '');
    setIgst(item.igst ? item.igst.toString() : '');
    setDiscount(item.discount ? item.discount.toString() : '');
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
      formData.append('cgst', cgst);
      formData.append('sgst', sgst);
      formData.append('igst', igst);
      formData.append('discount', discount);
      if (imageFiles && imageFiles.length > 0) {
        imageFiles.forEach(file => {
          formData.append('files', file);
        });
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
  const totalEstimatedCost = items
    .filter(item => item.status !== 'CANCELLED')
    .reduce((sum, item) => sum + (parseFloat(item.estimatedRate) * parseFloat(item.quantity) || 0), 0);
  const totalActualCost = items
    .filter(item => item.status === 'DELIVERED')
    .reduce((sum, item) => {
      const hasActual = item.actualRate !== null && item.actualRate !== undefined && item.actualRate !== '';
      const rate = hasActual ? parseFloat(item.actualRate) : parseFloat(item.estimatedRate);
      const base = rate * parseFloat(item.quantity) || 0;
      const cgstVal = parseFloat(item.cgst) || 0;
      const sgstVal = parseFloat(item.sgst) || 0;
      const igstVal = parseFloat(item.igst) || 0;
      const discVal = parseFloat(item.discount) || 0;
      return sum + (base + cgstVal + sgstVal + igstVal - discVal);
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
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Delivered / Spent Cost</span>
            <DollarSign size={18} color="var(--success)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.5rem' }}>
            {formatCurrency(totalActualCost)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Total actual cost of successfully arrived materials
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
        <div style={{ overflowX: 'auto', background: 'var(--glass-bg)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', animation: 'fadeIn 0.3s ease-out' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>Material & Vendor</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>Phase</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>Quantity</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>Est. Rate</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>Act. Rate</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>Total Cost</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Drive Folder</th>
                <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const cgstVal = parseFloat(item.cgst) || 0;
                const sgstVal = parseFloat(item.sgst) || 0;
                const igstVal = parseFloat(item.igst) || 0;
                const discVal = parseFloat(item.discount) || 0;

                const baseEst = parseFloat(item.estimatedRate) * parseFloat(item.quantity) || 0;
                const itemEst = item.status === 'CANCELLED' ? 0 : baseEst + cgstVal + sgstVal + igstVal - discVal;
                
                const hasActual = item.actualRate !== null && item.actualRate !== undefined && item.actualRate !== '';
                const baseAct = (hasActual ? parseFloat(item.actualRate) : parseFloat(item.estimatedRate)) * parseFloat(item.quantity) || 0;
                const itemAct = item.status === 'CANCELLED' ? 0 : baseAct + cgstVal + sgstVal + igstVal - discVal;

                const phaseName = phasesList.find(p => p.id === item.phaseId)?.name || 'Independent';

                return (
                  <tr 
                    key={item.id} 
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem' }}>{item.materialName}</div>
                      {item.vendorName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.vendorName}</div>}
                      
                      {/* Taxes & Discounts Badges */}
                      {(cgstVal > 0 || sgstVal > 0 || igstVal > 0 || discVal > 0) && (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                          {cgstVal > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                              CGST: {formatCurrency(cgstVal)}
                            </span>
                          )}
                          {sgstVal > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                              SGST: {formatCurrency(sgstVal)}
                            </span>
                          )}
                          {igstVal > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', background: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                              IGST: {formatCurrency(igstVal)}
                            </span>
                          )}
                          {discVal > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                              Disc: -{formatCurrency(discVal)}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {item.notes && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.25rem' }}>📝 {item.notes}</div>}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', fontSize: '0.75rem' }}>
                        📁 {phaseName}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      {parseFloat(item.quantity)} <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.unit}</span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-main)' }}>
                      {formatCurrency(parseFloat(item.estimatedRate))}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: item.actualRate ? 'var(--success)' : 'var(--text-muted)' }}>
                      {item.actualRate ? formatCurrency(parseFloat(item.actualRate)) : '—'}
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(itemAct)}</div>
                      {itemAct !== itemEst && (
                        <div style={{ fontSize: '0.65rem', color: itemAct > itemEst ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                          {itemAct > itemEst ? '▲' : '▼'} {formatCurrency(Math.abs(itemAct - itemEst))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span 
                        style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 800, 
                          padding: '0.3rem 0.6rem', 
                          borderRadius: '8px', 
                          letterSpacing: '0.05em',
                          background: 
                            item.status === 'DELIVERED' ? 'rgba(16, 185, 129, 0.12)' :
                            item.status === 'ORDERED' ? 'rgba(245, 158, 11, 0.12)' :
                            item.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                          color: 
                            item.status === 'DELIVERED' ? '#10b981' :
                            item.status === 'ORDERED' ? '#f59e0b' :
                            item.status === 'CANCELLED' ? '#ef4848' : '#3b82f6',
                          border: 
                            item.status === 'DELIVERED' ? '1px solid rgba(16, 185, 129, 0.2)' :
                            item.status === 'ORDERED' ? '1px solid rgba(245, 158, 11, 0.2)' :
                            item.status === 'CANCELLED' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)'
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                      {item.driveViewUrl ? (
                        <a 
                          href={item.driveViewUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.5rem',
                            borderRadius: '10px',
                            background: 'rgba(59, 130, 246, 0.12)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            transition: 'transform 0.1s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          title="Open Material Folder in Google Drive"
                        >
                          <FolderOpen size={18} fill="rgba(59, 130, 246, 0.2)" />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>No folder</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        {item.status === 'DELIVERED' && onPrefillExpense && (
                          <button 
                            onClick={() => onPrefillExpense({
                              description: `Procurement: ${item.materialName} (${parseFloat(item.quantity)} ${item.unit})`,
                              amount: itemAct,
                              actualAmount: baseAct,
                              cgst: parseFloat(item.cgst) || 0,
                              sgst: parseFloat(item.sgst) || 0,
                              igst: parseFloat(item.igst) || 0,
                              discount: parseFloat(item.discount) || 0,
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
                          style={{ padding: '0.45rem', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-main)', cursor: 'pointer' }}
                          title="Edit Item"
                        >
                          <Edit3 size={14} />
                        </button>

                        <button 
                          onClick={() => handleDelete(item.id)}
                          style={{ padding: '0.45rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', color: 'var(--danger)', cursor: 'pointer' }}
                          title="Delete Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      )}

      {/* Upload/Edit Modal */}
      {showFormModal && createPortal(
        <div 
          className="modal-overlay"  
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.75)', 
            backdropFilter: 'blur(12px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000,
            padding: '1.5rem'
          }}
        >
          <div className="modal-content glass-panel animate-in" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', borderRadius: '28px', background: 'var(--background)', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
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

              {/* Tax & Discount Section */}
              <div style={{
                padding: '1rem', 
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid var(--border)',
                marginTop: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                  💰 Tax & Discount (Optional)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>CGST Amount</label>
                    <input 
                      type="number" 
                      step="any"
                      value={cgst} 
                      onChange={e => setCgst(e.target.value)}
                      placeholder="e.g. 9.00"
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>SGST Amount</label>
                    <input 
                      type="number" 
                      step="any"
                      value={sgst} 
                      onChange={e => setSgst(e.target.value)}
                      placeholder="e.g. 9.00"
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>IGST Amount</label>
                    <input 
                      type="number" 
                      step="any"
                      value={igst} 
                      onChange={e => setIgst(e.target.value)}
                      placeholder="e.g. 18.00"
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Discount Amount</label>
                    <input 
                      type="number" 
                      step="any"
                      value={discount} 
                      onChange={e => setDiscount(e.target.value)}
                      placeholder="e.g. 50.00"
                      style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--glass-bg)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  💡 Entered values will be added/subtracted to/from the total cost and prefilled during expense booking.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.75rem', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Upload Photo(s) (Google Drive)</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    multiple
                    onChange={e => setImageFiles(Array.from(e.target.files))}
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
        </div>,
        document.body
      )}

      {/* Lightbox Preview Modal */}
      {previewImage && createPortal(
        <div 
          className="modal-overlay" 
          onClick={() => setPreviewImage(null)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1100, 
            background: 'rgba(15, 23, 42, 0.85)', 
            backdropFilter: 'blur(12px)',
            padding: '1.5rem'
          }}
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
        </div>,
        document.body
      )}
    </div>
  );
}
