import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import { getJournal, getTrialBalance, getLedger } from './accounting.service';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';

type ReportType = 'journal' | 'trial-balance' | 'ledger';

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const formatCurrency = (amount: any) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(Number(amount?.toString() || amount || 0)));
};

const getDrCr = (amount: number | string, accountType: string) => {
  const val = Number(amount);
  const isNormalDebit = ['ASSET', 'EXPENSE'].includes(accountType);
  if (isNormalDebit) {
    return val >= 0 ? 'Dr' : 'Cr';
  } else {
    return val >= 0 ? 'Cr' : 'Dr';
  }
};

const makeHeader = (text: string, fontSize: number = 26) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: fontSize * 2, color: '000000', font: 'Arial' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  });

const makeSubHeader = (text: string) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, color: '000000', font: 'Arial' })],
    spacing: { before: 400, after: 200 },
    border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 10 } }
  });

const tableCell = (text: string, isHeader = false) =>
  new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text), bold: isHeader, size: 19, color: '000000', font: 'Arial' })],
      }),
    ],
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    shading: isHeader ? { fill: 'f8fafc' } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    },
  });

// ── Generate Word Report ───────────────────────────────────────────────────
export const generateReport = async (
  projectId: string,
  reportType: ReportType | 'Full',
  phaseIds?: string[],
  params?: any
): Promise<Buffer> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) throw new ApiError(404, 'Project not found.');

  const phaseLabel =
    phaseIds && phaseIds.length > 0
      ? `(Phases: ${phaseIds.join(', ')})`
      : '(All Phases)';

  const headerText = params?.custom_header || `${project.name} — ${reportType.toUpperCase()} REPORT`;

  const sections: (Paragraph | Table)[] = [];
  
  if (params?.show_date_corner) {
      const cornerDate = params.report_date 
        ? formatDate(new Date(params.report_date)) 
        : formatDate(new Date());
        
      sections.push(new Paragraph({
         text: cornerDate,
         alignment: AlignmentType.RIGHT,
         spacing: { after: 400 }
      }));
  }

  sections.push(makeHeader(headerText, params?.header_font_size || 26));
  
  if (params?.sub_headers) {
      params.sub_headers.forEach((sh: any) => {
          sections.push(new Paragraph({ children: [new TextRun({ text: sh.text, bold: true, size: (sh.font_size || 12) * 2, color: '334155', font: 'Arial' })], spacing: { after: 200 }, alignment: AlignmentType.CENTER }));
      });
  } else {
      sections.push(makeSubHeader(`Generated: ${formatDate(new Date())}  ${phaseLabel}`));
  }

  // Determine sections to show
  const showJournal = reportType === 'journal' || (reportType === 'Full' && params?.sections?.journal);
  const showTrialBalance = reportType === 'trial-balance' || (reportType === 'Full' && params?.sections?.trialBalance);
  const showLedger = reportType === 'ledger' || (reportType === 'Full' && params?.sections?.ledger);

  let sectionCounter = 1;
  const getSectionNum = () => {
    if (params?.use_roman_numerals === false) return `${sectionCounter++}. `;
    const romans = ["I", "II", "III", "IV", "V", "VI", "VII"];
    return `${romans[sectionCounter++ - 1] || sectionCounter}. `;
  };

  if (showJournal) {
    sections.push(makeSubHeader(getSectionNum() + "JOURNAL ENTRIES"));
    const entries = await getJournal(projectId, phaseIds);

    const colHeaders = ['Date', 'Phase', 'From', 'To', 'Category', 'Amount', 'Description'];
    const headerRow = new TableRow({
      children: colHeaders.map(h => tableCell(h, true)),
    });

    const dataRows = entries.map(entry => {
      // Prefer new DB columns; fall back to parsing description for legacy entries
      let fromEntity = entry.fromEntity || '';
      let toEntity = entry.toEntity || '';
      if (!fromEntity && entry.description?.includes('| From:')) {
        const parts = entry.description.split('|');
        const m = parts[1]?.match(/From: (.*?) To: (.*)/);
        if (m) { fromEntity = m[1]?.trim() || ''; toEntity = m[2]?.trim() || ''; }
      }
      let pureDesc = entry.description || '';
      if (pureDesc.includes('| From:')) {
        pureDesc = pureDesc.split('|')[0]?.trim() || '';
      }

      const debitLine = entry.lines.find((l: any) => l.type === 'DEBIT');
      const categoryName = debitLine?.account?.name || '';
      const amount = debitLine ? `₹${formatCurrency(debitLine.amount)}` : '₹0.00';

      return new TableRow({
        children: [
          tableCell(formatDate(entry.date)),
          tableCell(entry.phase?.name || 'Project'),
          tableCell(fromEntity || '-'),
          tableCell(toEntity || '-'),
          tableCell(categoryName || '-'),
          tableCell(amount),
          tableCell(pureDesc || '-'),
        ],
      });
    });

    sections.push(new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
    sections.push(new Paragraph({ text: '', spacing: { after: 300 } }));
  }

  if (showLedger) {
    sections.push(makeSubHeader(getSectionNum() + "GENERAL LEDGER"));
    
    // Get all accounts to find which ones have activity
    const tb = await getTrialBalance(projectId, phaseIds);
    // Find active accounts (non-zero debit or credit sum)
    let activeAccounts = tb.accounts.filter(a => a.debits !== "0.00" || a.credits !== "0.00");

    // If specific accounts were selected in UI, filter them here
    if (params?.ledger_accounts && Array.isArray(params.ledger_accounts) && params.ledger_accounts.length > 0) {
        activeAccounts = activeAccounts.filter(a => params.ledger_accounts.includes(a.name));
    }

    if (params?.combine_ledger_accounts) {
      let combinedEntries: any[] = [];
      
      // Fetch all entries for active accounts
      for (const acc of activeAccounts) {
        const entries = await getLedger(projectId, acc.id, phaseIds);
        entries.forEach(e => combinedEntries.push({ ...e, accountName: acc.name }));
      }
      
      // Sort chronologically
      combinedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const ledgerHeaders = ['Date', 'Phase', 'Account Name', 'Debit', 'Credit', 'Running Balance'];
      const headerRow = new TableRow({ children: ledgerHeaders.map(h => tableCell(h, true)) });

      const dataRows = combinedEntries.map(e => new TableRow({
        children: [
          tableCell(formatDate(e.date)),
          tableCell(e.phaseName || 'Project'),
          tableCell(e.accountName),
          tableCell(e.type === 'DEBIT' ? `₹${formatCurrency(e.amount)}` : '-'),
          tableCell(e.type === 'CREDIT' ? `₹${formatCurrency(e.amount)}` : '-'),
          tableCell(`₹${formatCurrency(e.runningBalance)} ${getDrCr(e.runningBalance, e.accountType)}`)
        ]
      }));

      sections.push(new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE }
      }));
      sections.push(new Paragraph({ text: '', spacing: { after: 300 } }));

    } else {
      for (const acc of activeAccounts) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: `ACCOUNT: ${acc.name}`, bold: true, size: 24, color: '334155', font: 'Arial' })],
          spacing: { before: 200, after: 200 }
        }));

        const entries = await getLedger(projectId, acc.id, phaseIds);
        const ledgerHeaders = ['Date', 'Phase', 'Debit', 'Credit', 'Running Balance'];
        const headerRow = new TableRow({ children: ledgerHeaders.map(h => tableCell(h, true)) });

        const dataRows = entries.map(e => new TableRow({
          children: [
            tableCell(formatDate(e.date)),
            tableCell(e.phaseName || 'Project'),
            tableCell(e.type === 'DEBIT' ? `₹${formatCurrency(e.amount)}` : '-'),
            tableCell(e.type === 'CREDIT' ? `₹${formatCurrency(e.amount)}` : '-'),
            tableCell(`₹${formatCurrency(e.runningBalance)} ${getDrCr(e.runningBalance, e.accountType)}`)
          ]
        }));

        sections.push(new Table({
          rows: [headerRow, ...dataRows],
          width: { size: 100, type: WidthType.PERCENTAGE }
        }));
        sections.push(new Paragraph({ text: '', spacing: { after: 300 } }));
      }
    }
  }

  if (showTrialBalance) {
    sections.push(makeSubHeader(getSectionNum() + "TRIAL BALANCE"));
    const tb = await getTrialBalance(projectId, phaseIds);

    const rows = [
      new TableRow({
        children: [
          tableCell('Account', true),
          tableCell('Type', true),
          tableCell('Debit Balance (₹)', true),
          tableCell('Credit Balance (₹)', true),
        ],
      }),
      ...Object.values(tb.accounts).map((acc: any) => {
        const balanceVal = parseFloat(acc.balance);
        return new TableRow({
          children: [
            tableCell(acc.name),
            tableCell(acc.type),
            tableCell(balanceVal > 0 ? formatCurrency(balanceVal) : '0.00'),
            tableCell(balanceVal < 0 ? formatCurrency(Math.abs(balanceVal)) : '0.00'),
          ],
        });
      }),
      new TableRow({
        children: [
          tableCell('TOTAL', true),
          tableCell(''),
          tableCell(formatCurrency(tb.totals.totalDebits), true),
          tableCell(formatCurrency(tb.totals.totalCredits), true),
        ],
      }),
    ];

    sections.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  }

  const doc = new Document({
    sections: [{ children: sections }],
    creator: 'Double Entry System',
    title: headerText,
  });

  return Packer.toBuffer(doc);
};
