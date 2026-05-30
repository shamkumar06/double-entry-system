import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import {
  User, Users, DollarSign, Save, Calendar, Layers,
  CheckCircle, XCircle, ShieldCheck, ShieldOff, Plus, RefreshCw, Loader,
  Key, Trash2, UserPlus, Fingerprint, Crown
} from 'lucide-react';
import { useProjectData } from '../context/ProjectDataContext';
import { accountingApi, authApi } from '../services/api';
import ConfirmationDialog from './ConfirmationDialog';

// ─────────────────────────────────────────────────
// Tiny reusable section header
// ─────────────────────────────────────────────────
function SectionHeader({ icon, color, bg, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
      <div style={{ color, background: bg, padding: '0.5rem', borderRadius: '8px' }}>{icon}</div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
    </div>
  );
}

export default function Settings({ activeProject, onUpdate, user }) {
  const { settings, updateSettings, updateProfile } = useSettings();
  const { members, invalidate } = useProjectData();
  const [profile, setProfile] = useState({ ...settings.profile });
  const [saved, setSaved] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  // ── Phase state ──────────────────────────────────
  const [phases, setPhases] = useState([]);
  const [phasesLoading, setPhasesLoading] = useState(false);
  const [settlingId, setSettlingId] = useState(null);

  // ── Team members state ───────────────────────────
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberRole, setMemberRole] = useState('STUDENT');
  const [parentMemberId, setParentMemberId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // ── User management state ────────────────────────
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'VIEWER' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // ── Custom Confirmation Dialog state ─────────────
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: () => {}
  });

  const triggerConfirm = ({ title, message, confirmText, cancelText, type, onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      type,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // ── Load phases from API ─────────────────────────
  const fetchPhases = async () => {
    if (!activeProject?.id) return;
    setPhasesLoading(true);
    try {
      const data = await accountingApi.listPhases(activeProject.id);
      setPhases(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load phases', e);
    } finally {
      setPhasesLoading(false);
    }
  };

  useEffect(() => { fetchPhases(); }, [activeProject?.id]);

  // ── Load users (admin only) ──────────────────────
  const fetchUsers = async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const data = await authApi.listUsers();
      setAllUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin]);

  // ── Handlers ─────────────────────────────────────
  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleReportSection = (section) => {
    updateSettings({
      reportSections: { ...settings.reportSections, [section]: !settings.reportSections[section] }
    });
  };

  const handleToggleSettlement = (phase) => {
    const action = phase.isSettled ? 'Unsettle' : 'Settle';
    const msg = phase.isSettled
      ? `Unsettle "${phase.name}"? This will reopen it for editing.`
      : `Settle "${phase.name}"? It will become read-only.`;

    triggerConfirm({
      title: `${action} Phase`,
      message: msg,
      confirmText: action,
      cancelText: 'Cancel',
      type: phase.isSettled ? 'danger' : 'info',
      onConfirm: async () => {
        setSettlingId(phase.id);
        try {
          if (phase.isSettled) {
            // Use dedicated unsettle endpoint — handles all edge cases cleanly
            await accountingApi.unsettlePhase(activeProject.id, phase.id);
          } else {
            await accountingApi.updatePhase(activeProject.id, phase.id, { isSettled: true });
          }
          await fetchPhases();
          if (onUpdate) onUpdate();
        } catch (e) {
          alert('Action failed: ' + (e?.error || e?.message || 'Unknown error'));
        } finally {
          setSettlingId(null);
        }
      }
    });
  };

  const handleAddMember = async () => {
    if (!memberName.trim()) return;
    setAddingMember(true);
    try {
      await accountingApi.addMember(activeProject.id, { 
        name: memberName.trim(), 
        role: memberRole, 
        phone: memberPhone.trim() || null,
        parentMemberId: memberRole === 'PROCURING_STUDENT' && parentMemberId ? parentMemberId : null
      });
      setMemberName(''); setMemberPhone(''); setMemberRole('STUDENT'); setParentMemberId('');
      invalidate(activeProject.id);
    } catch (err) {
      alert('Failed to add member: ' + (err?.error || err.message));
    } finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this team member?')) return;
    try {
      await accountingApi.removeMember(activeProject.id, memberId);
      invalidate(activeProject.id);
    } catch (err) { alert('Failed to remove member.'); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');
    if (newUser.password.length < 8) { setUserError('Password must be at least 8 characters.'); return; }
    setCreatingUser(true);
    try {
      await authApi.adminCreateUser(newUser.email, newUser.password, newUser.role, newUser.name || undefined);
      setUserSuccess(`Account for ${newUser.email} created successfully as ${newUser.role}.`);
      setNewUser({ name: '', email: '', password: '', role: 'VIEWER' });
      setShowCreateUser(false);
      await fetchUsers();
    } catch (e) {
      setUserError(e?.error || e?.message || 'Failed to create user.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangeRole = (userId, currentRole) => {
    const newRole = currentRole === 'ADMIN' ? 'VIEWER' : 'ADMIN';
    triggerConfirm({
      title: 'Change User Role',
      message: `Change this user's role to ${newRole}?`,
      confirmText: 'Update Role',
      cancelText: 'Cancel',
      type: 'info',
      onConfirm: async () => {
        try {
          await authApi.changeUserRole(userId, newRole);
          await fetchUsers();
        } catch (e) {
          alert('Failed to change role: ' + (e?.error || e?.message));
        }
      }
    });
  };

  const handleResetPassword = async (userId, email) => {
    const newPass = window.prompt(`Reset password for ${email}. Enter new password (min 8 chars):`);
    if (!newPass) return;
    if (newPass.length < 8) { alert('Password too short.'); return; }
    try {
      await authApi.resetPassword(userId, newPass);
      alert('Password reset successfully.');
    } catch (e) {
      alert('Failed to reset: ' + (e?.error || e?.message));
    }
  };

  const handleToggleActive = (userToUpdate) => {
    const newStatus = !userToUpdate.isActive;
    const msg = newStatus ? `Reactivate account for ${userToUpdate.email}?` : `Deactivate account for ${userToUpdate.email}? They will be blocked from logging in.`;

    triggerConfirm({
      title: newStatus ? 'Reactivate User' : 'Deactivate User',
      message: msg,
      confirmText: newStatus ? 'Reactivate' : 'Deactivate',
      cancelText: 'Cancel',
      type: newStatus ? 'success' : 'danger',
      onConfirm: async () => {
        try {
          await authApi.updateUser(userToUpdate.id, { isActive: newStatus });
          await fetchUsers();
        } catch (e) {
          alert('Failed to update status: ' + (e?.error || e?.message));
        }
      }
    });
  };

  const handleDeleteUser = (userToDelete) => {
    triggerConfirm({
      title: 'Delete User Account',
      message: `PERMANENTLY DELETE user ${userToDelete.email}? This cannot be undone.`,
      confirmText: 'Delete User',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          await authApi.deleteUser(userToDelete.id);
          await fetchUsers();
        } catch (e) {
          alert('Failed to delete: ' + (e?.error || e?.message));
        }
      }
    });
  };

  // ── Shared input style ────────────────────────────
  const inp = {
    width: '100%', padding: '0.6rem 0.9rem', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text-main)', fontSize: '0.9rem', boxSizing: 'border-box',
  };

  return (
    <div className="settings-container">

      {/* ── Phase Management ── */}
      {activeProject && (
        <div className="glass-panel settings-panel">
          <SectionHeader
            icon={<Layers size={20} />}
            color="var(--primary)"
            bg="rgba(99,102,241,0.1)"
            title="Phase Management"
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Manage the settlement status of phases for <strong>{activeProject.name}</strong>.
            Settled phases are read-only.
          </p>

          {phasesLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading phases…
            </div>
          ) : phases.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No phases found for this project.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {phases.map(ph => (
                <div key={ph.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1rem 1.25rem', borderRadius: '12px', background: 'var(--surface)',
                  border: ph.isSettled ? '1px solid var(--success)' : '1px solid var(--border)',
                  transition: 'border-color 0.2s'
                }}>
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{ph.name}</p>
                    <p style={{ fontSize: '0.75rem', color: ph.isSettled ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500 }}>
                      {ph.isSettled ? '✅ SETTLED — Read-only' : '🟢 ACTIVE — Open'}
                    </p>
                  </div>
                  <button
                    disabled={settlingId === ph.id}
                    onClick={() => handleToggleSettlement(ph)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
                      cursor: settlingId === ph.id ? 'wait' : 'pointer',
                      border: '1.5px solid currentColor',
                      background: 'transparent',
                      color: ph.isSettled ? 'var(--primary)' : 'var(--success)',
                      opacity: settlingId === ph.id ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = ph.isSettled ? 'var(--primary)' : 'var(--success)'; e.currentTarget.style.color = 'white'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ph.isSettled ? 'var(--primary)' : 'var(--success)'; }}
                  >
                    {settlingId === ph.id
                      ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : ph.isSettled ? <XCircle size={14} /> : <CheckCircle size={14} />
                    }
                    {settlingId === ph.id ? 'Saving…' : ph.isSettled ? 'Unsettle' : 'Settle Phase'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Team Members (Cashiers) ── */}
      {activeProject && (
        <div className="glass-panel settings-panel">
          <SectionHeader
            icon={<Users size={20} />}
            color="#6366f1"
            bg="rgba(99,102,241,0.1)"
            title="Team Members (Cashiers)"
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Add your Faculty Guide and Student Sub-Cashiers to track who is handling the money.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Name</label>
              <input type="text" style={inp} value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="e.g. Prof. Kumar" />
            </div>
            <div style={{ flex: '0 1 140px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Phone (Optional)</label>
              <input type="tel" style={inp} value={memberPhone} onChange={e => setMemberPhone(e.target.value)} placeholder="9876543210" />
            </div>
            <div style={{ flex: '0 1 150px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Role</label>
              <select style={inp} value={memberRole} onChange={e => { setMemberRole(e.target.value); if (e.target.value !== 'PROCURING_STUDENT') setParentMemberId(''); }}>
                <option value="STUDENT">Student Sub-Cashier</option>
                <option value="GUIDE">Faculty Guide / Main Cashier</option>
                <option value="PROCURING_STUDENT">Procuring Student</option>
              </select>
            </div>
            {memberRole === 'PROCURING_STUDENT' && (
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Assigned Cashier</label>
                <select style={inp} value={parentMemberId} onChange={e => setParentMemberId(e.target.value)}>
                  <option value="">— Select Cashier —</option>
                  {(members || []).filter(m => m.role !== 'PROCURING_STUDENT' && m.isActive !== false).map(m => (
                    <option key={m.id} value={m.id}>{m.role === 'GUIDE' ? '👑 ' : '🎓 '}{m.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button type="button" className="btn-primary" onClick={handleAddMember} disabled={addingMember || !memberName.trim() || (memberRole === 'PROCURING_STUDENT' && !parentMemberId)} style={{ padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
              <Plus size={16} /> {addingMember ? 'Adding...' : 'Add'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(members || []).slice().sort((a, b) => (a.role === 'GUIDE' ? -1 : a.role === 'STUDENT' ? 0 : 1)).map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', borderRadius: '12px',
                background: m.role === 'GUIDE' 
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.04))' 
                  : m.role === 'PROCURING_STUDENT'
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.04))'
                    : 'var(--surface-hover)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: m.role === 'GUIDE' 
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' 
                      : m.role === 'PROCURING_STUDENT'
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : `linear-gradient(135deg, #10b98133, #10b98111)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: m.role === 'GUIDE' || m.role === 'PROCURING_STUDENT' ? '#fff' : '#10b981',
                    fontWeight: 800, fontSize: '0.8rem',
                  }}>
                    {m.role === 'GUIDE' ? <Crown size={16} /> : m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{m.name}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {m.role === 'GUIDE' ? '👑 Faculty Guide' : (m.role === 'PROCURING_STUDENT' ? '🎓 Procuring Student' : '🎓 Student Sub-Cashier')}
                      {m.role === 'PROCURING_STUDENT' && m.parentMemberId && (
                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                          {' · assigned to ' + ((members || []).find(p => p.id === m.parentMemberId)?.name || 'unknown')}
                        </span>
                      )}
                      {m.phone ? ` · ${m.phone}` : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleRemoveMember(m.id)} style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: '0.4rem', borderRadius: '8px',
                }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {(!members || members.length === 0) && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.85rem' }}>
                No team members added yet. Start by adding your Faculty Guide.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── User Management (Admin Only) ── */}
      {isAdmin && (
        <div className="glass-panel settings-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <SectionHeader
              icon={<Users size={20} />}
              color="var(--accent, #f59e0b)"
              bg="rgba(245,158,11,0.1)"
              title="User Management"
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button
                onClick={fetchUsers}
                title="Refresh users"
                className="settings-refresh-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                <RefreshCw size={13} /> <span className="responsive-btn-text">Refresh</span>
              </button>
              <button
                onClick={() => { setShowCreateUser(v => !v); setUserError(''); setUserSuccess(''); }}
                className="settings-add-user-btn"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.9rem', borderRadius: '8px', background: 'var(--primary)', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', border: 'none' }}
              >
                <Plus size={13} /> <span className="responsive-btn-text">Add User</span>
              </button>
            </div>
          </div>

          {/* Success / Error flash */}
          {userSuccess && (
            <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', padding: '0.6rem 0.9rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              ✅ {userSuccess}
            </div>
          )}
          {userError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '0.6rem 0.9rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              ❌ {userError}
            </div>
          )}

          {/* Create User inline form */}
          {showCreateUser && (
            <form onSubmit={handleCreateUser} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>➕ Create New User</p>
              <div className="settings-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Full Name (optional)</label>
                  <input style={inp} value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Email *</label>
                  <input style={inp} type="email" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@example.com" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Password *</label>
                  <input style={inp} type="password" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 8 characters" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Role *</label>
                  <select style={{ ...inp }} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="VIEWER">VIEWER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreateUser(false)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                <button type="submit" disabled={creatingUser} style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', border: 'none', opacity: creatingUser ? 0.7 : 1 }}>
                  {creatingUser ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          {usersLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading users…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {allUsers.map(u => (
                  <div key={u.id} className="settings-user-card" style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.85rem 1.1rem', borderRadius: '10px', background: 'var(--surface)',
                    border: u.role === 'ADMIN' ? '1px solid rgba(245,158,11,0.35)' : '1px solid var(--border)',
                    opacity: u.isActive ? 1 : 0.6,
                    filter: u.isActive ? 'none' : 'grayscale(0.5)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.name || '—'}{' '}
                        {u.id === user?.id && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>(you)</span>}
                        {!u.isActive && <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', background: 'var(--danger)', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>DEACTIVATED</span>}
                      </p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{u.email}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{
                        padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                        background: u.role === 'ADMIN' ? 'rgba(245,158,11,0.15)' : 'rgba(2,132,199,0.12)',
                        color: u.role === 'ADMIN' ? '#d97706' : 'var(--primary)',
                        border: u.role === 'ADMIN' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(2,132,199,0.25)',
                      }}>
                        {u.role}
                      </span>
                      
                      {/* Action Group: Protect against self-management */}
                      {u.id !== user?.id && u.email !== user?.email && (
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button
                            onClick={() => handleChangeRole(u.id, u.role)}
                            title={u.role === 'ADMIN' ? 'Demote to Viewer' : 'Promote to Admin'}
                            className="icon-btn-maintenance"
                            style={{ color: u.role === 'ADMIN' ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {u.role === 'ADMIN' ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                          </button>

                          <button
                            onClick={() => handleResetPassword(u.id, u.email)}
                            title="Reset Password"
                            className="icon-btn-maintenance"
                            style={{ color: 'var(--primary)' }}
                          >
                            <Key size={14} />
                          </button>

                          <button
                            onClick={() => handleToggleActive(u)}
                            title={u.isActive ? 'Deactivate' : 'Activate'}
                            className="icon-btn-maintenance"
                            style={{ color: u.isActive ? 'var(--orange, #f97316)' : 'var(--success)' }}
                          >
                            {u.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u)}
                            title="Permanent Delete"
                            className="icon-btn-maintenance"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Display Preferences ── */}
      <div className="glass-panel settings-panel">
        <SectionHeader icon={<Calendar size={20} />} color="var(--secondary)" bg="rgba(16,185,129,0.1)" title="Display Preferences" />
        <div className="settings-display-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Theme</label>
            <select value={settings.theme || 'light'} onChange={e => updateSettings({ theme: e.target.value })}>
              <option value="light">Light Mode</option>
              <option value="dark">Dark Mode</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Date Format</label>
            <select value={settings.dateFormat} onChange={e => updateSettings({ dateFormat: e.target.value })}>
              <option value="YYYY-MM-DD">YYYY-MM-DD (Standard)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (Common)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Default View Order</label>
            <select value={settings.sortOrder} onChange={e => updateSettings({ sortOrder: e.target.value })}>
              <option value="Descending">Newest First (Descending)</option>
              <option value="Ascending">Oldest First (Ascending)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Currency ── */}
      <div className="glass-panel settings-panel">
        <SectionHeader icon={<DollarSign size={20} />} color="var(--primary)" bg="rgba(79,70,229,0.1)" title="Currency & Region" />
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>Active Currency</label>
            <select
              value={settings.currency}
              onChange={e => updateSettings({ currency: e.target.value })}
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 600 }}
            >
              {Object.keys(settings.rates || { 'INR': 1 }).sort().map(code => (
                <option key={code} value={code}>
                  {code === 'INR' ? '₹ Indian Rupee (INR)' : `${code} (${(settings.rates?.[code] || 1).toFixed(2)})`}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('https://open.er-api.com/v6/latest/INR');
                  const data = await res.json();
                  if (data.result === 'success' && data.rates) {
                    updateSettings({ rates: data.rates });
                    alert('Successfully updated live conversion rates.');
                  }
                } catch { alert('Network error while fetching rates.'); }
              }}
              className="btn-secondary"
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', borderRadius: '12px' }}
            >
              🔄 Sync Rates
            </button>
          </div>
        </div>
      </div>

      {/* ── Report Profile ── */}
      <div className="glass-panel settings-panel">
        <SectionHeader icon={<User size={20} />} color="var(--danger)" bg="rgba(239,68,68,0.1)" title="Report Profile (Header Info)" />
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

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .icon-btn-maintenance {
          display: flex; 
          align-items: center; 
          justify-content: center;
          padding: 0.5rem; 
          border-radius: 8px; 
          cursor: pointer; 
          border: 1px solid var(--border);
          background: var(--background);
          transition: all 0.15s ease;
        }
        .icon-btn-maintenance:hover {
          background: var(--surface);
          border-color: var(--text-muted);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
