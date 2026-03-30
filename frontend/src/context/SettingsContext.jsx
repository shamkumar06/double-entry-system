import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'des_settings';

const defaultSettings = {
    currency: 'INR',
    dateFormat: 'YYYY-MM-DD', // Options: 'YYYY-MM-DD', 'DD/MM/YYYY'
    sortOrder: 'Descending',  // Options: 'Ascending', 'Descending'
    reportSections: {
        journal: true,
        ledger: true,
        trialBalance: true
    },
    rates: { 'INR': 1 }, 
    profile: {
        name: '',
        organization: '',
        email: '',
        phone: ''
    },
    reportConfig: {
        customHeader: '',
        subHeaders: [{ text: '', fontSize: 12 }],
        showDateCorner: true,
        footerNote: '',
        showFooterNote: false,
        ledgerAccounts: [],
        selectedColumns: {
            journal: ["Date", "Phase", "From", "To", "Category", "Description", "Amount"],
            ledger: ["Date", "Phase", "Debit", "Credit", "Running Balance"],
            trialBalance: ["Account Name", "Debit Balance", "Credit Balance"]
        }
    }
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return defaultSettings;
            const parsed = JSON.parse(stored);
            // Deep merge: preserve new default keys in nested objects
            return {
                ...defaultSettings,
                ...parsed,
                reportConfig: { ...defaultSettings.reportConfig, ...(parsed.reportConfig || {}) },
                profile: { ...defaultSettings.profile, ...(parsed.profile || {}) },
                rates: { ...defaultSettings.rates, ...(parsed.rates || {}) },
                reportSections: { ...defaultSettings.reportSections, ...(parsed.reportSections || {}) }
            };
        } catch {
            return defaultSettings;
        }
    });

    // Persist to localStorage every time settings change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, [settings]);

    const updateSettings = (partial) => {
        setSettings(prev => ({ ...prev, ...partial }));
    };

    const updateProfile = (partial) => {
        setSettings(prev => ({ ...prev, profile: { ...prev.profile, ...partial } }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, updateProfile }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    return useContext(SettingsContext);
}

export function useFormatting() {
    const { settings } = useSettings();
    const rate = settings.rates?.[settings.currency] || 1;

    const formatCurrency = (rawAmount) => {
        let amount = (rawAmount || 0) * rate; 
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: settings.currency,
                minimumFractionDigits: 2
            }).format(amount);
        } catch (e) {
            return `${settings.currency} ${amount.toFixed(2)}`;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const d = dateString.split('T')[0]; // Handle ISO strings
        const [y, m, d_] = d.split('-');
        if (settings.dateFormat === 'DD/MM/YYYY') {
            return `${d_}/${m}/${y}`;
        }
        return d;
    };

    const sortData = (data, dateKey = 'date') => {
        const sorted = [...data].sort((a, b) => {
            const da = new Date(a[dateKey] || a.transaction_date || 0);
            const db = new Date(b[dateKey] || b.transaction_date || 0);
            return settings.sortOrder === 'Ascending' ? da - db : db - da;
        });
        return sorted;
    };

    return { 
        formatCurrency, 
        format: formatCurrency, // Backward compatibility
        formatDate, 
        sortData,
        currency: settings.currency, 
        symbol: settings.currency, // Symbol alias
        dateFormat: settings.dateFormat,
        sortOrder: settings.sortOrder
    };
}

// Deprecated: use useFormatting instead
export function useCurrency() {
    return useFormatting();
}
