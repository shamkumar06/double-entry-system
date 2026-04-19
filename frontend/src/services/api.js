import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

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

  // --- Categories / System ---
  listCategories: () => api.get('/system/categories'),
  createCategory: (data) => api.post('/system/categories', data),
  deleteCategory: (id) => api.delete(`/system/categories/${id}`),
  renameCategory: (id, newName) => api.put(`/system/categories/${id}`, { name: newName }),

  // --- Transactions ---
  createTransaction: (data) => api.post('/accounting/journal', data),
  updateTransaction: (id, data) => api.put(`/accounting/journal/${id}`, data),
  deleteTransaction: (id) => api.delete(`/accounting/journal/${id}`),
  uploadReceipt: async (file, folder = 'receipts') => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_URL}/accounting/upload?folder=${folder}`, formData, {
      withCredentials: true,
    });
    return res.data?.data?.url || res.data?.url;
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
    // Custom wrapper if your UI needs specific sums, but generally use the standard trial-balance API for aggregate sums.
    // Assuming backend returns phase sums elsewhere or derived here:
    return []; 
  },

  // Word Document generator
  generateReport: async (projectId, projectName, reportType, phaseId = null, params = {}) => {
    try {
      const response = await axios({
        method: 'POST',
        url: `${API_URL}/accounting/reports/generate`,
        data: {
          projectId,
          reportType,
          phaseIds: phaseId ? (Array.isArray(phaseId) ? phaseId : [phaseId]) : undefined,
          params  // ← Bug 1 fix: pass the entire params object to the backend
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
