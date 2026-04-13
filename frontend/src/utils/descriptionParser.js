/**
 * Parses the enriched transaction description format:
 *   "Pure description | From: senderName To: receiverName | Mode: UPI (GPay) Ref: 12345"
 *
 * This is the SINGLE source of truth for all description disassembly.
 * Use this instead of duplicating regex parsing in Journal, Reports, RecycleBin, or report.service.
 */
export function parseDescription(description = '') {
    if (!description || !description.includes('| From:')) {
        return {
            pureDesc: description || '',
            fromName: '-',
            toName: '-',
            paymentMode: '-',
            refId: '',
        };
    }

    const parts = description.split('|');
    const pureDesc = parts[0]?.trim() || '';

    let fromName = '-';
    let toName = '-';
    let paymentMode = '-';
    let refId = '';

    if (parts[1]) {
        const fromToMatch = parts[1].match(/From: (.*?) To: (.*)/);
        if (fromToMatch) {
            fromName = fromToMatch[1]?.trim() || '-';
            toName = fromToMatch[2]?.trim() || '-';
        }
    }

    if (parts[2]) {
        const modeRefMatch = parts[2].match(/Mode: (.*?) Ref: (.*)/);
        if (modeRefMatch) {
            paymentMode = modeRefMatch[1]?.trim() || '-';
            refId = modeRefMatch[2]?.trim() || '';
        }
    }

    return { pureDesc, fromName, toName, paymentMode, refId };
}

/**
 * Builds the enriched description string from atoms.
 * Use this in TransactionForm / PhaseSelector when creating/updating entries.
 */
export function buildDescription(pureDesc, fromName, toName, paymentMode, refId) {
    if (!fromName && !toName && !paymentMode) return pureDesc;
    const from = fromName || '-';
    const to = toName || '-';
    const mode = paymentMode || 'N/A';
    const ref = refId || '-';
    return `${pureDesc} | From: ${from} To: ${to} | Mode: ${mode} Ref: ${ref}`;
}
