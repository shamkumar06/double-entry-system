import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit3, Image, FileText, CheckCircle, Package, Layers, DollarSign, Calendar, Info, Loader2, ArrowRight, FolderOpen, Download, ExternalLink, X, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Photos Gallery / Lightbox Viewer States
  const [galleryItem, setGalleryItem] = useState(null);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  const openGallery = async (item) => {
    setGalleryItem(item);
    setLightboxOpen(false);
    setGalleryPhotos([]);
    setGalleryLoading(true);
    setCurrentPhotoIndex(0);
    setGalleryError('');
    try {
      const data = await procurementApi.listPhotos(projectId, item.id);
      setGalleryPhotos(data || []);
    } catch (e) {
      console.error('Failed to list photos:', e);
      setGalleryError(e.message || 'Failed to retrieve files.');
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleUploadExtraPhotos = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingExtra(true);
    setGalleryError('');
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const res = await procurementApi.uploadPhotos(projectId, galleryItem.id, formData);
      if (res && res.photos) {
        setGalleryPhotos(res.photos);
        setCurrentPhotoIndex(res.photos.length - files.length); // Focus on first new upload
        fetchItems(); // Refresh main table
      }
    } catch (e) {
      console.error('Failed to upload extra photos:', e);
      setGalleryError(e.message || 'Upload failed.');
    } finally {
      setUploadingExtra(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Are you sure you want to permanently delete this photo?')) return;

    setUploadingExtra(true);
    setGalleryError('');
    try {
      const res = await procurementApi.deletePhoto(projectId, galleryItem.id, photoId);
      if (res && res.photos) {
        setGalleryPhotos(res.photos);
        if (res.photos.length === 0) {
          setLightboxOpen(false);
        }
        // Adjust index if we deleted the last file or the selected file
        setCurrentPhotoIndex(prev => {
          if (prev >= res.photos.length) {
            return Math.max(0, res.photos.length - 1);
          }
          return prev;
        });
      }
    } catch (e) {
      console.error('Failed to delete photo:', e);
      setGalleryError(e.message || 'Deletion failed.');
    } finally {
      setUploadingExtra(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '—';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
      {galleryItem && !lightboxOpen ? (
        <div style={{ animation: 'fadeIn 0.4s ease-out', width: '100%' }}>
          {/* Breadcrumb / Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button 
              onClick={() => setGalleryItem(null)} 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                color: 'var(--text-muted)', 
                fontSize: '0.85rem',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                width: 'fit-content',
                outline: 'none'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <ChevronLeft size={16} /> Back to Pipeline
            </button>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FolderOpen size={28} color="var(--primary)" />
                  {galleryItem.materialName} Folder Assets
                </h2>
                {galleryItem.vendorName && (
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Vendor: <strong>{galleryItem.vendorName}</strong> | Phase: <strong>{phasesList.find(p => p.id === galleryItem.phaseId)?.name || 'Independent'}</strong>
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input 
                  type="file" 
                  id="gallery-grid-upload-input" 
                  multiple 
                  accept="image/*"
                  onChange={handleUploadExtraPhotos} 
                  style={{ display: 'none' }} 
                />
                <button 
                  onClick={() => document.getElementById('gallery-grid-upload-input').click()}
                  disabled={uploadingExtra}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '12px', fontWeight: 700 }}
                >
                  {uploadingExtra ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Add Extra Photos
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Notice */}
          {galleryError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem', marginBottom: '1.5rem', fontWeight: 600 }}>
              ⚠️ {galleryError}
            </div>
          )}

          {/* Loader or Photo Card Grid */}
          {galleryLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', background: 'var(--glass-bg)', borderRadius: '24px', border: '1px solid var(--border)' }}>
              <Loader2 size={40} className="spin" color="var(--primary)" />
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fetching folder photos...</p>
            </div>
          ) : galleryPhotos.length === 0 ? (
            <div className="glass-panel animate-in" style={{ padding: '4rem 2rem', borderRadius: '24px', textAlign: 'center', background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
              <Image size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>No Photos inside this Folder</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '380px', margin: '0.5rem auto 1.5rem auto' }}>
                Store receipts, delivery challans, and material photos securely in this dedicated Google Drive folder.
              </p>
              <button 
                onClick={() => document.getElementById('gallery-grid-upload-input').click()} 
                className="btn-primary" 
                style={{ padding: '0.6rem 1.2rem', borderRadius: '12px' }}
              >
                Upload First Photo
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {galleryPhotos.map((photo, idx) => (
                <div 
                  key={photo.id}
                  className="glass-panel animate-in"
                  style={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    background: 'var(--glass-bg)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    position: 'relative'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.15)';
                    const overlay = e.currentTarget.querySelector('.photo-overlay');
                    if (overlay) overlay.style.opacity = 1;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    const overlay = e.currentTarget.querySelector('.photo-overlay');
                    if (overlay) overlay.style.opacity = 0;
                  }}
                  onClick={() => {
                    setCurrentPhotoIndex(idx);
                    setLightboxOpen(true);
                  }}
                >
                  {/* Card Photo Preview */}
                  <div style={{ position: 'relative', width: '100%', height: '180px', overflow: 'hidden', background: '#090d16' }}>
                    <img 
                      src={procurementApi.getPhotoViewUrl(projectId, photo.id)} 
                      alt={photo.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    
                    {/* Source Tag */}
                    <span 
                      style={{ 
                        position: 'absolute', 
                        top: '12px', 
                        left: '12px', 
                        fontSize: '0.65rem', 
                        fontWeight: 800, 
                        padding: '0.25rem 0.55rem', 
                        borderRadius: '8px', 
                        background: 'rgba(15, 23, 42, 0.75)', 
                        backdropFilter: 'blur(8px)', 
                        color: photo.source === 'google' ? '#10b981' : '#3b82f6', 
                        border: '1px solid rgba(255, 255, 255, 0.08)' 
                      }}
                    >
                      {photo.source === 'google' ? '📁 Google Drive' : '☁️ Supabase'}
                    </span>

                    {/* Hover Image Overlay */}
                    <div 
                      className="photo-overlay" 
                      style={{ 
                        position: 'absolute', 
                        inset: 0, 
                        background: 'rgba(15, 23, 42, 0.55)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        opacity: 0, 
                        transition: 'opacity 0.25s ease', 
                        backdropFilter: 'blur(3px)' 
                      }}
                    >
                      <span 
                        style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 800, 
                          color: '#fff', 
                          background: '#3b82f6', 
                          padding: '0.45rem 0.85rem', 
                          borderRadius: '10px', 
                          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)' 
                        }}
                      >
                        Preview Image ➔
                      </span>
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                    <div 
                      style={{ 
                        fontWeight: 800, 
                        color: 'var(--text-main)', 
                        fontSize: '0.85rem', 
                        wordBreak: 'break-all', 
                        display: '-webkit-box', 
                        WebkitBoxOrient: 'vertical', 
                        WebkitLineClamp: 2, 
                        overflow: 'hidden', 
                        lineHeight: 1.4 
                      }}
                    >
                      {photo.name}
                    </div>
                    
                    <div 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.35rem', 
                        fontSize: '0.7rem', 
                        color: 'var(--text-muted)', 
                        marginTop: 'auto', 
                        borderTop: '1px solid var(--border)', 
                        paddingTop: '0.75rem' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Uploaded On</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {photo.createdTime ? new Date(photo.createdTime).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>File Size</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {formatBytes(photo.size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Direct download / delete actions */}
                  <div 
                    style={{ padding: '0 1.25rem 1.25rem 1.25rem', display: 'flex', gap: '0.5rem' }} 
                    onClick={e => e.stopPropagation()}
                  >
                    <a 
                      href={procurementApi.getPhotoDownloadUrl(projectId, photo.id)}
                      download
                      style={{ 
                        flex: 1, 
                        padding: '0.5rem', 
                        borderRadius: '8px', 
                        border: '1px solid var(--border)', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        color: 'var(--text-main)', 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        textDecoration: 'none', 
                        textAlign: 'center', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.25rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                    >
                      <Download size={12} /> Download
                    </a>
                    
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      style={{ 
                        flex: 1, 
                        padding: '0.5rem', 
                        borderRadius: '8px', 
                        border: '1px solid rgba(239, 68, 68, 0.2)', 
                        background: 'rgba(239, 68, 68, 0.05)', 
                        color: '#ef4444', 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}

              {/* Dashed "+ Add Photo" Card */}
              <div 
                className="glass-panel animate-in" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '1rem', 
                  border: '2px dashed var(--border)', 
                  borderRadius: '24px', 
                  cursor: 'pointer', 
                  minHeight: '300px', 
                  transition: 'all 0.2s', 
                  color: 'var(--text-muted)',
                  background: 'rgba(255, 255, 255, 0.01)'
                }}
                onClick={() => document.getElementById('gallery-grid-upload-input').click()}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'; }}
              >
                {uploadingExtra ? (
                  <>
                    <Loader2 size={32} className="spin" color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Uploading Photos...</span>
                  </>
                ) : (
                  <>
                    <Plus size={32} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Add Extra Photos</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
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
                          <button 
                            onClick={() => openGallery(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.5rem',
                              borderRadius: '10px',
                              background: item.driveViewUrl ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                              border: item.driveViewUrl ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid var(--border)',
                              color: item.driveViewUrl ? '#3b82f6' : 'var(--text-muted)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.1)';
                              if (item.driveViewUrl) {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                              } else {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.background = item.driveViewUrl ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.05)';
                            }}
                            title={item.driveViewUrl ? "Open Gallery & Folder Viewer" : "Create Folder / Add Photos"}
                          >
                            <FolderOpen size={18} fill={item.driveViewUrl ? "rgba(59, 130, 246, 0.2)" : "transparent"} />
                          </button>
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
        </>
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

      {/* Procurement Media Gallery & Lightbox Modal */}
      {galleryItem && lightboxOpen && createPortal(
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1100, 
            background: 'rgba(5, 8, 16, 0.88)', 
            backdropFilter: 'blur(16px)',
            padding: '2rem'
          }}
        >
          <div 
            style={{ 
              display: 'flex', 
              width: '100%', 
              maxWidth: '1200px', 
              height: '85vh', 
              background: 'rgba(15, 23, 42, 0.65)', 
              borderRadius: '24px', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)', 
              overflow: 'hidden',
              backdropFilter: 'blur(30px)'
            }}
          >
            {/* Left: Main Slider/Gallery Panel (70%) */}
            <div 
              style={{ 
                flex: '1', 
                display: 'flex', 
                flexDirection: 'column', 
                position: 'relative', 
                background: 'rgba(0, 0, 0, 0.4)',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              {/* Close Icon / Header Info */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '1.25rem 2rem', 
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  background: 'rgba(0,0,0,0.2)'
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                    {galleryItem.materialName}
                  </h4>
                  {galleryItem.vendorName && (
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                      Vendor: {galleryItem.vendorName}
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setLightboxOpen(false)}
                  style={{ 
                    background: 'rgba(255,255,255,0.06)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    color: '#fff', 
                    borderRadius: '50%', 
                    width: '36px', 
                    height: '36px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer',
                    transition: 'background 0.2s' 
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Loader */}
              {galleryLoading ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={36} className="spin" color="#3b82f6" />
                  <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Listing files securely...</p>
                </div>
              ) : galleryError ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                  <Info size={40} color="#ef4444" style={{ animation: 'bounce 1s infinite' }} />
                  <p style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{galleryError}</p>
                </div>
              ) : galleryPhotos.length === 0 ? (
                // Empty State Upload Trigger
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                  <div 
                    onClick={() => document.getElementById('gallery-modal-upload-input').click()}
                    style={{ 
                      width: '100%', 
                      maxWidth: '400px', 
                      padding: '3rem 2rem', 
                      borderRadius: '20px', 
                      border: '2px dashed rgba(255, 255, 255, 0.15)', 
                      background: 'rgba(255,255,255,0.02)', 
                      textAlign: 'center', 
                      cursor: 'pointer', 
                      transition: 'border 0.2s, background 0.2s' 
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    }}
                  >
                    <Image size={40} color="rgba(255,255,255,0.3)" style={{ marginBottom: '1rem' }} />
                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>No Photos in Folder Yet</h5>
                    <p style={{ margin: '0.5rem 0 1.5rem 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                      Create this folder in your Drive by uploading some files now.
                    </p>
                    <span className="btn-primary" style={{ padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                      + Add Photos
                    </span>
                  </div>
                </div>
              ) : (
                // Image Slider
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', padding: '1rem' }}>
                  {/* Image Display */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', position: 'relative' }}>
                    {galleryPhotos[currentPhotoIndex] && (
                      <img 
                        src={procurementApi.getPhotoViewUrl(projectId, galleryPhotos[currentPhotoIndex].id)} 
                        alt={galleryPhotos[currentPhotoIndex].name} 
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '52vh', 
                          borderRadius: '16px', 
                          objectFit: 'contain',
                          boxShadow: '0 15px 40px rgba(0,0,0,0.6)',
                          border: '1px solid rgba(255,255,255,0.08)'
                        }} 
                      />
                    )}

                    {/* Left Navigation Arrow */}
                    {galleryPhotos.length > 1 && (
                      <button 
                        onClick={() => setCurrentPhotoIndex(prev => (prev === 0 ? galleryPhotos.length - 1 : prev - 1))}
                        style={{ 
                          position: 'absolute', 
                          left: '1rem', 
                          background: 'rgba(15, 23, 42, 0.6)', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '50%', 
                          width: '40px', 
                          height: '40px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: '#fff', 
                          cursor: 'pointer',
                          backdropFilter: 'blur(8px)',
                          transition: 'background 0.2s' 
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#3b82f6'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)'}
                      >
                        <ChevronLeft size={20} />
                      </button>
                    )}

                    {/* Right Navigation Arrow */}
                    {galleryPhotos.length > 1 && (
                      <button 
                        onClick={() => setCurrentPhotoIndex(prev => (prev === galleryPhotos.length - 1 ? 0 : prev + 1))}
                        style={{ 
                          position: 'absolute', 
                          right: '1rem', 
                          background: 'rgba(15, 23, 42, 0.6)', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '50%', 
                          width: '40px', 
                          height: '40px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: '#fff', 
                          cursor: 'pointer',
                          backdropFilter: 'blur(8px)',
                          transition: 'background 0.2s' 
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#3b82f6'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)'}
                      >
                        <ChevronRight size={20} />
                      </button>
                    )}
                  </div>

                  {/* Thumbnail Row */}
                  <div 
                    style={{ 
                      width: '100%', 
                      padding: '1rem 0', 
                      display: 'flex', 
                      gap: '0.5rem', 
                      justifyContent: 'center', 
                      overflowX: 'auto',
                      background: 'rgba(0,0,0,0.2)',
                      borderTop: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    {galleryPhotos.map((p, idx) => (
                      <div 
                        key={p.id}
                        onClick={() => setCurrentPhotoIndex(idx)}
                        style={{ 
                          width: '60px', 
                          height: '60px', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          border: idx === currentPhotoIndex ? '2px solid #3b82f6' : '2px solid transparent', 
                          opacity: idx === currentPhotoIndex ? 1 : 0.5,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <img 
                          src={procurementApi.getPhotoViewUrl(projectId, p.id)} 
                          alt="thumbnail" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Glassmorphic Sidebar (30%) */}
            <div 
              style={{ 
                width: '320px', 
                display: 'flex', 
                flexDirection: 'column', 
                background: 'rgba(15, 23, 42, 0.4)',
                padding: '1.5rem',
                justifyContent: 'space-between',
                boxSizing: 'border-box'
              }}
            >
              {/* File details & description */}
              <div>
                <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                  Asset Details
                </h5>

                {galleryPhotos.length > 0 && galleryPhotos[currentPhotoIndex] ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Name */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                      <label style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '0.2rem' }}>File Name</label>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff', wordBreak: 'break-all' }}>
                        {galleryPhotos[currentPhotoIndex].name}
                      </span>
                    </div>

                    {/* Date Created */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                      <label style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '0.2rem' }}>Uploaded On</label>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>
                        {galleryPhotos[currentPhotoIndex].createdTime ? new Date(galleryPhotos[currentPhotoIndex].createdTime).toLocaleString() : '—'}
                      </span>
                    </div>

                    {/* Size */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                      <label style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '0.2rem' }}>File Size</label>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>
                        {formatBytes(galleryPhotos[currentPhotoIndex].size)}
                      </span>
                    </div>

                    {/* Storage Provider */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                      <label style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '0.2rem' }}>Provider</label>
                      <span 
                        style={{ 
                          fontSize: '0.7rem', 
                          fontWeight: 700, 
                          color: galleryPhotos[currentPhotoIndex].source === 'google' ? '#10b981' : '#3b82f6',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        {galleryPhotos[currentPhotoIndex].source === 'google' ? '📁 Google Drive' : '☁️ Supabase Cloud'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                    No file selected.
                  </p>
                )}
              </div>

              {/* Action Buttons & Upload shortcuts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
                <input 
                  type="file" 
                  id="gallery-modal-upload-input" 
                  multiple 
                  accept="image/*"
                  onChange={handleUploadExtraPhotos} 
                  style={{ display: 'none' }} 
                />

                {galleryPhotos.length > 0 && galleryPhotos[currentPhotoIndex] && (
                  <>
                    {/* Redirect to Drive / Direct Web Link */}
                    {galleryPhotos[currentPhotoIndex].webViewLink && (
                      <a 
                        href={galleryPhotos[currentPhotoIndex].webViewLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-primary" 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '0.5rem', 
                          padding: '0.6rem 1rem', 
                          borderRadius: '12px', 
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textAlign: 'center',
                          textDecoration: 'none',
                          color: '#fff',
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      >
                        <ExternalLink size={14} />
                        View Source Link
                      </a>
                    )}

                    {/* Download Button */}
                    <a 
                      href={procurementApi.getPhotoDownloadUrl(projectId, galleryPhotos[currentPhotoIndex].id)}
                      download
                      className="btn-primary" 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.5rem', 
                        padding: '0.6rem 1rem', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        textDecoration: 'none',
                        color: '#fff',
                        background: '#3b82f6',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                    >
                      <Download size={14} />
                      Download File
                    </a>

                    {/* Delete File Button */}
                    <button 
                      onClick={() => handleDeletePhoto(galleryPhotos[currentPhotoIndex].id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.5rem', 
                        padding: '0.6rem 1rem', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                    >
                      <Trash2 size={14} />
                      Delete File
                    </button>
                  </>
                )}

                {/* Add More Photos Shortcut */}
                <button 
                  onClick={() => document.getElementById('gallery-modal-upload-input').click()}
                  disabled={uploadingExtra}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '0.5rem', 
                    padding: '0.6rem 1rem', 
                    borderRadius: '12px', 
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                  }}
                >
                  {uploadingExtra ? (
                    <>
                      <Loader2 size={14} className="spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Add Extra Photos
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
