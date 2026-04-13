import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { accountingApi } from '../services/api';

// ── State Shape ────────────────────────────────────────────────────────────
const initialState = {
    project: null,
    journal: [],           // All active transactions (isDeleted: false)
    categories: [],        // AccountCategory list
    phaseFinances: {},     // Map<phaseId, { received, spent, balance, budget }>
    projectFinances: null, // { received, spent, balance }
    loading: false,
    error: null,
    version: 0,            // Increment to trigger re-fetch
};

// ── Reducer ────────────────────────────────────────────────────────────────
function reducer(state, action) {
    switch (action.type) {
        case 'LOAD_START':
            return { ...state, loading: true, error: null };

        case 'LOAD_SUCCESS':
            return {
                ...state,
                loading: false,
                project: action.payload.project,
                journal: action.payload.journal,
                categories: action.payload.categories,
                phaseFinances: action.payload.phaseFinances,
                projectFinances: action.payload.projectFinances,
            };

        case 'LOAD_ERROR':
            return { ...state, loading: false, error: action.payload };

        case 'ADD_TRANSACTION':
            return { ...state, journal: [action.payload, ...state.journal] };

        case 'REMOVE_TRANSACTION':
            return {
                ...state,
                journal: state.journal.filter(tx => tx.id !== action.payload),
            };

        case 'UPDATE_TRANSACTION':
            return {
                ...state,
                journal: state.journal.map(tx =>
                    tx.id === action.payload.id ? action.payload : tx
                ),
            };

        case 'INVALIDATE':
            return { ...state, version: state.version + 1 };

        case 'RESET':
            return initialState;

        default:
            return state;
    }
}

// ── Context ────────────────────────────────────────────────────────────────
const ProjectDataContext = createContext(null);

export function ProjectDataProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    /**
     * Loads all project data in 3 parallel API calls.
     * Fires: getProject, getJournal, getPhaseFinancials
     */
    const loadProject = useCallback(async (projectId, phaseId = null) => {
        if (!projectId) return;
        dispatch({ type: 'LOAD_START' });
        try {
            const [project, journal, categories, phaseFinancesArr] = await Promise.all([
                accountingApi.getProject(projectId),
                accountingApi.getJournal(projectId, phaseId),
                accountingApi.listCategories(),
                accountingApi.getPhaseFinancials(projectId).catch(() => []),
            ]);

            // Build the phaseFinances map for O(1) lookups
            const phaseFinances = {};
            (phaseFinancesArr || []).forEach(pf => {
                phaseFinances[pf.phaseId] = pf;
            });

            // projectFinances live on the project object (from backend aggregation)
            const projectFinances = {
                received: Number(project.received_amount) || 0,
                spent:    Number(project.spent_amount)    || 0,
                balance:  Number(project.remaining_balance) || 0,
            };

            dispatch({
                type: 'LOAD_SUCCESS',
                payload: { project, journal, categories, phaseFinances, projectFinances },
            });
        } catch (e) {
            console.error('ProjectDataContext load error:', e);
            dispatch({ type: 'LOAD_ERROR', payload: e.message || 'Failed to load project data' });
        }
    }, []);

    /**
     * Call after adding a transaction — optimistically updates the journal.
     */
    const addTransaction = useCallback((tx) => {
        dispatch({ type: 'ADD_TRANSACTION', payload: tx });
    }, []);

    /**
     * Call after deleting a transaction — removes it from local state instantly.
     */
    const removeTransaction = useCallback((id) => {
        dispatch({ type: 'REMOVE_TRANSACTION', payload: id });
    }, []);

    /**
     * Call after editing a transaction — replaces it in local state instantly.
     */
    const updateTransaction = useCallback((tx) => {
        dispatch({ type: 'UPDATE_TRANSACTION', payload: tx });
    }, []);

    /**
     * Forces a full re-fetch from backend. Use sparingly (e.g. after phase deletion).
     */
    const invalidate = useCallback((projectId, phaseId) => {
        dispatch({ type: 'INVALIDATE' });
        if (projectId) loadProject(projectId, phaseId);
    }, [loadProject]);

    /**
     * Clears all project data (e.g. when navigating back to Home).
     */
    const reset = useCallback(() => {
        dispatch({ type: 'RESET' });
    }, []);

    const value = {
        ...state,
        loadProject,
        addTransaction,
        removeTransaction,
        updateTransaction,
        invalidate,
        reset,
    };

    return (
        <ProjectDataContext.Provider value={value}>
            {children}
        </ProjectDataContext.Provider>
    );
}

export function useProjectData() {
    const ctx = useContext(ProjectDataContext);
    if (!ctx) throw new Error('useProjectData must be used within a ProjectDataProvider');
    return ctx;
}
