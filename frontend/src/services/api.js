import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

// Configure Axios with a 30-second timeout for large data sets
axios.defaults.timeout = 30000;

export const accountingApi = {
    // Submit a new transaction
    createTransaction: async (data) => {
        // Data must now contain project_id and category_id
        const response = await axios.post(`${API_BASE_URL}/transactions`, data);
        return response.data;
    },
    updateTransaction: async (id, data) => {
        const response = await axios.put(`${API_BASE_URL}/transactions/${id}`, data);
        return response.data;
    },

    // Delete a transaction and its ledger entries
    deleteTransaction: async (transactionId) => {
        const response = await axios.delete(`${API_BASE_URL}/transactions/${transactionId}`);
        return response.data;
    },

    // Upload a receipt or material bill image
    uploadReceipt: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axios.post(`${API_BASE_URL}/upload_receipt`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.url;
    },

    // --- Projects ---
    listProjects: async () => {
        const response = await axios.get(`${API_BASE_URL}/projects/`);
        return response.data;
    },
    createProject: async (data) => {
        const response = await axios.post(`${API_BASE_URL}/projects/`, data);
        return response.data;
    },
    deleteProject: async (id) => {
        const response = await axios.delete(`${API_BASE_URL}/projects/${id}`);
        return response.data;
    },
    updateProject: async (id, data) => {
        const response = await axios.put(`${API_BASE_URL}/projects/${id}`, data);
        return response.data;
    },

    // --- Phases (sub-resource of project) ---
    listPhases: async (projectId) => {
        const response = await axios.get(`${API_BASE_URL}/projects/${projectId}/phases`);
        return response.data;
    },
    createPhase: async (projectId, data) => {
        const response = await axios.post(`${API_BASE_URL}/projects/${projectId}/phases`, data);
        return response.data;
    },
    deletePhase: async (projectId, phaseId) => {
        const response = await axios.delete(`${API_BASE_URL}/projects/${projectId}/phases/${phaseId}`);
        return response.data;
    },
    updatePhase: async (projectId, phaseId, data) => {
        const response = await axios.put(`${API_BASE_URL}/projects/${projectId}/phases/${phaseId}`, data);
        return response.data;
    },

    // --- Categories ---
    listCategories: async () => {
        const response = await axios.get(`${API_BASE_URL}/categories/`);
        return response.data;
    },
    createCategory: async (data) => {
        const response = await axios.post(`${API_BASE_URL}/categories/`, data);
        return response.data;
    },
    deleteCategory: async (id) => {
        const response = await axios.delete(`${API_BASE_URL}/categories/${id}`);
        return response.data;
    },
    renameCategory: async (id, newName) => {
        const response = await axios.put(`${API_BASE_URL}/categories/${id}`, { name: newName });
        return response.data;
    },
    
    // --- ID-First Accounting Reports ---
    getJournal: async (projectId, phaseId = null) => {
        const response = await axios.get(`${API_BASE_URL}/journal`, { 
            params: { project_id: projectId, phase_id: phaseId || undefined } 
        });
        return response.data;
    },
    
    getTrialBalance: async (projectId, phaseId = null) => {
        const response = await axios.get(`${API_BASE_URL}/trial-balance`, { 
            params: { project_id: projectId, phase_id: phaseId || undefined } 
        });
        return response.data;
    },

    getLedger: async (projectId, accountId, phaseId = null) => {
        const response = await axios.get(`${API_BASE_URL}/ledger`, { 
            params: { project_id: projectId, account_id: accountId, phase_id: phaseId || undefined } 
        });
        return response.data;
    },

    getPhasesTotals: async (projectId) => {
        const response = await axios.get(`${API_BASE_URL}/phases/totals`, { 
            params: { project_id: projectId } 
        });
        return response.data;
    },
    
    // Generate and download a Word Document Report
    generateReport: async (projectId, projectName, reportType, phaseId = null, params = {}) => {
        const response = await axios.post(`${API_BASE_URL}/reports/generate`, {
            project_id: projectId,
            project_name: projectName,
            report_type: reportType,
            phase_id: phaseId || null,
            ...params
        }, { responseType: 'blob' });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const safeReportType = reportType ? reportType.replace(/ /g, '_') : 'Report';
        link.setAttribute('download', `${safeReportType}_${projectName}.docx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    // --- Recycle Bin ---
    listDeleted: async (projectId) => {
        const response = await axios.get(`${API_BASE_URL}/recycle-bin`, { params: { project_id: projectId } });
        return response.data;
    },
    restoreTransaction: async (transactionId) => {
        const response = await axios.post(`${API_BASE_URL}/recycle-bin/restore/${transactionId}`);
        return response.data;
    }
};
