import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';
export const BASE_URL = API_URL.replace(/\/api$/, '');

export const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the token if it exists in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Setup an interceptor to extract the standard { success, data } payloads
api.interceptors.response.use(
  (response) => {
    // If the response contains a new token (login/register), save it!
    if (response.data && response.data.data && response.data.data.token) {
      localStorage.setItem('token', response.data.data.token);
    }

    if (response.data && response.data.success !== undefined && response.data.data !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized, clear the token as it's likely invalid
      localStorage.removeItem('token');
    }
    return Promise.reject(error.response?.data || error);
  }
);

// Auth
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, name) => api.post('/auth/register', { email, password, name }),
  logout: () => {
    localStorage.removeItem('token');
    return api.post('/auth/logout');
  },
  getMe: () => api.get('/auth/me'),

  // Admin user management
  listUsers: () => api.get('/auth/admin/users'),
  adminCreateUser: (email, password, role, name) =>
    api.post('/auth/admin/create', { email, password, role, name }),
  changeUserRole: (userId, role) =>
    api.patch(`/auth/admin/users/${userId}/role`, { role }),
  resetPassword: (userId, password) =>
    api.post(`/auth/admin/users/${userId}/reset-password`, { password }),
  updateUser: (userId, data) =>
    api.patch(`/auth/admin/users/${userId}`, data),
  deleteUser: (userId) =>
    api.delete(`/auth/admin/users/${userId}`),
};

// --- Client-side Cache for Static Lookup Data ---
let categoriesCache = null;

export const accountingApi = {
  // --- Projects ---
  listProjects: () => api.get('/projects'),
  getProject: (id) => api.get(`/projects/${id}`),
  createProject: (data) => api.post('/projects', data),
  updateProject: (id, data) => api.put(`/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/projects/${id}`),

  // --- Phases ---
  listPhases: (projectId) => api.get(`/projects/${projectId}/phases`),
  createPhase: (projectId, data) => api.post(`/projects/${projectId}/phases`, data),
  updatePhase: (projectId, phaseId, data) => api.put(`/projects/${projectId}/phases/${phaseId}`, data),
  deletePhase: (projectId, phaseId) => api.delete(`/projects/${projectId}/phases/${phaseId}`),
  settlePhase: (projectId, phaseId) => api.post(`/projects/${projectId}/phases/${phaseId}/settle`),
  reallocateSurplus: (projectId, phaseId, sourcePhaseId) => api.post(`/projects/${projectId}/phases/${phaseId}/reallocate`, { sourcePhaseId }),

  // --- Categories / System ---
  listCategories: () => {
    if (categoriesCache) return Promise.resolve(categoriesCache);
    return api.get('/system/categories').then(data => {
      categoriesCache = data;
      return data;
    });
  },
  createCategory: (data) => {
    categoriesCache = null;
    return api.post('/system/categories', data);
  },
  deleteCategory: (id) => {
    categoriesCache = null;
    return api.delete(`/system/categories/${id}`);
  },
  renameCategory: (id, newName) => {
    categoriesCache = null;
    return api.put(`/system/categories/${id}`, { name: newName });
  },

  // --- Transactions ---
  createTransaction: (data) => api.post('/accounting/journal', data),
  updateTransaction: (id, data) => api.put(`/accounting/journal/${id}`, data),
  deleteTransaction: (id) => api.delete(`/accounting/journal/${id}`),
  uploadReceipt: async (file, folder = 'receipts') => {
    const supabaseUrl = 'https://sildxjncajthkoybgyno.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpbGR4am5jYWp0aGtveWJneW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTU5MTksImV4cCI6MjA5NDQ5MTkxOX0.kxjsPtCYJ3hFodomkg2cxljxmu--UWazKK7pzOBLlDI';

    const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.png';
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/attachments/${folder}/${uniqueFilename}`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': file.type || 'image/png',
        },
        body: file
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Supabase direct upload failed: ${errText}`);
      }

      return `${supabaseUrl}/storage/v1/object/public/attachments/${folder}/${uniqueFilename}`;
    } catch (error) {
      console.warn('Direct Supabase upload failed, falling back to backend upload:', error);
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/accounting/upload?folder=${folder}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.url || res.data?.url;
    }
  },

  // --- Reports & Reporting ---
  getJournal: (projectId, phaseId = null) => {
    let url = `/accounting/journal?projectId=${projectId}`;
    if (phaseId) url += `&phases=${phaseId}`;
    return api.get(url);
  },

  getTrialBalance: (projectId, phaseId = null) => {
    let url = `/accounting/trial-balance?projectId=${projectId}`;
    if (phaseId) url += `&phases=${phaseId}`;
    return api.get(url);
  },

  getLedger: (projectId, accountId, phaseId = null) => {
    let url = `/accounting/ledger?projectId=${projectId}&accountId=${accountId}`;
    if (phaseId) url += `&phases=${phaseId}`;
    return api.get(url);
  },

  getPhasesTotals: async (projectId) => {
    return []; 
  },

  // Word Document generator
  generateReport: async (projectId, projectName, reportType, phaseId = null, params = {}) => {
    try {
      const headers = {};
      const token = localStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await axios({
        method: 'POST',
        url: `${API_URL}/accounting/reports/generate`,
        headers,
        data: {
          projectId,
          reportType,
          phaseIds: phaseId ? (Array.isArray(phaseId) ? phaseId : phaseId.split(',').filter(Boolean)) : undefined,
          params
        },
        responseType: 'blob',
        withCredentials: true,
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${projectName}_${reportType}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed', error);
      throw error;
    }
  },

  // Phase financial aggregates (single backend call)
  getPhaseFinancials: (projectId) => api.get(`/projects/${projectId}/phase-financials`),

  // --- Recycle Bin (interceptor already unwraps { success, data } → data) ---
  listDeleted: (projectId) => api.get(`/accounting/journal/deleted?projectId=${projectId}`),
  restoreTransaction: (id) => api.post(`/accounting/journal/${id}/restore`)
};
