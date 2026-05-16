import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, HeadingLevel,
  BorderStyle, ShadingType, convertInchesToTwip,
} from 'docx';
import * as accountingService from './accounting.service';
import prisma from '../lib/prisma';

// ── Formatting helpers (match frontend) ────────────────────
const fmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

// ── Parse description to extract From / To (matches frontend Reports.jsx logic) ──
function parseDescription(description: string | null | undefined) {
  let pureDesc = description || '';
  let fromName = '-';
  let toName = '-';

  if (description?.includes('| From:')) {
    const parts = description.split('|');
    pureDesc = parts[0]?.trim() || '';
    const fromToMatch = parts[1]?.match(/From: (.*?) To: (.*)/);
    if (fromToMatch) {
      fromName = fromToMatch[1]?.trim() || '-';
      toName = fromToMatch[2]?.trim() || '-';
    }
  }
  return { pureDesc, fromName, toName };
}

// ── Dr / Cr label (matches frontend getDrCr) ──────────────
function getDrCr(amt: number, accountType: string): string {
  const isNormalDebit = ['ASSET', 'EXPENSE'].includes(accountType);
  if (isNormalDebit) return amt >= 0 ? 'Dr' : 'Cr';
  return amt >= 0 ? 'Cr' : 'Dr';
}

// ── Styling constants ──────────────────────────────────────
const HEADING_COLOR = '1e293b';          // section heading text
const TABLE_HEADER_BG = 'f8fafc';        // light gray — matches preview
const BORDER_COLOR = '000000';           // black borders — matches preview
const CELL_PADDING = { top: 60, bottom: 60, left: 80, right: 80 }; // ~4pt padding

function makeBorders(color = BORDER_COLOR) {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: TABLE_HEADER_BG },
    borders: makeBorders(),
    margins: CELL_PADDING,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text, bold: true, color: '000000', size: 18 })],
    })],
  });
}

function dataCell(text: string, _shaded = false, right = false): TableCell {
  return new TableCell({
    borders: makeBorders(),
    margins: CELL_PADDING,
    children: [new Paragraph({
      alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text, size: 18 })],
    })],
  });
}

function sectionHeading(text: string, fontSize = 28): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: HEADING_COLOR } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: fontSize, color: HEADING_COLOR })],
  });
}

// ── Types ──────────────────────────────────────────────────
interface ReportParams {
  projectId: string;
  projectName?: string;
  phaseIds?: string[];
  params?: {
    custom_header?: string;
    sub_headers?: Array<{ text: string; font_size?: number }>;
    show_date_corner?: boolean;
    report_date?: string;
    show_title_line?: boolean;
    footer_note?: string;
    show_footer_note?: boolean;
    columns?: {
      journal?: string[];
      ledger?: string[];
      trialBalance?: string[];
    };
    start_date?: string;
    end_date?: string;
    sections?: {
      journal?: boolean;
      ledger?: boolean;
      trialBalance?: boolean;
    };
    use_roman_numerals?: boolean;
    combine_ledger_accounts?: boolean;
    header_font_size?: number;
    ledger_accounts?: string[];
  };
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
let sectionCounter = 0;

function nextHeadingNum(useRoman: boolean) {
  sectionCounter++;
  return useRoman ? (ROMAN[sectionCounter] || String(sectionCounter)) : String(sectionCounter);
}

// ══════════════════════════════════════════════════════════
//  MAIN EXPORT
// ══════════════════════════════════════════════════════════
export async function generateReportBuffer(opts: ReportParams): Promise<Buffer> {
  const { projectId, projectName, phaseIds, params = {} } = opts;
  const useRoman = params.use_roman_numerals !== false;
  sectionCounter = 0;

  const sections = params.sections || { journal: true, ledger: false, trialBalance: true };
  const columns = params.columns || {};

  // ── Fetch data ───────────────────────────────────────────
  const [journalData, trialBalanceData, allAccounts] = await Promise.all([
    sections.journal
      ? accountingService.getJournal(projectId, phaseIds?.length ? phaseIds : undefined)
      : Promise.resolve([]),
    sections.trialBalance
      ? accountingService.getTrialBalance(projectId, phaseIds?.length ? phaseIds : undefined)
      : Promise.resolve(null),
    sections.ledger
      ? prisma.accountCategory.findMany({ orderBy: { code: 'asc' } })
      : Promise.resolve([]),
  ]);

  // Date range filtering
  const startDate = params.start_date ? new Date(params.start_date) : null;
  const endDate = params.end_date ? new Date(params.end_date) : null;

  const filteredJournal = (journalData as any[]).filter((tx: any) => {
    const d = new Date(tx.date);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  });

  // ── Build document children ──────────────────────────────
  const children: (Paragraph | Table)[] = [];

  // Title
  const titleText = params.custom_header || projectName || 'Accounting Report';
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({
      text: titleText,
      bold: true,
      size: (params.header_font_size || 26) * 2,
      color: HEADING_COLOR,
    })],
  }));

  // Title underline
  if (params.show_title_line !== false) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
      children: [],
    }));
  }

  // Sub-headings
  (params.sub_headers || []).forEach(sh => {
    if (!sh.text?.trim()) return;
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: sh.text, size: (sh.font_size || 12) * 2, italics: true, color: '475569' })],
    }));
  });

  // Date corner
  if (params.show_date_corner) {
    const dateStr = params.report_date
      ? new Date(params.report_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : fmtDate(new Date());
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
      children: [new TextRun({ text: dateStr, size: 18, color: '64748b' })],
    }));
  }

  // Divider
  children.push(new Paragraph({
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: HEADING_COLOR } },
    children: [],
  }));

  // ══════════════════════════════════════════════════════════
  //  JOURNAL — one row per TRANSACTION (matches frontend preview)
  // ══════════════════════════════════════════════════════════
  if (sections.journal && filteredJournal.length > 0) {
    const journalCols: string[] = columns.journal?.length
      ? columns.journal
      : ['Date', 'Phase', 'From', 'To', 'Category', 'Description', 'Amount'];

    children.push(sectionHeading(`${nextHeadingNum(useRoman)}. Journal Entries`));

    const headerRow = new TableRow({
      tableHeader: true,
      children: journalCols.map(c => headerCell(c)),
    });

    const dataRows: TableRow[] = filteredJournal.map((tx: any, txIdx: number) => {
      const shaded = txIdx % 2 === 0;
      const lines: any[] = tx.lines || [];

      // ── Match frontend Reports.jsx logic exactly ──
      const primaryAccount = lines.find((l: any) => l.type === 'DEBIT')?.account?.name || '-';
      const txAmount = Number(lines[0]?.amount || 0);
      const { pureDesc, fromName, toName } = parseDescription(tx.description);

      // Use tx.fromEntity / toEntity as fallback
      const resolvedFrom = fromName !== '-' ? fromName : (tx.fromEntity || '-');
      const resolvedTo = toName !== '-' ? toName : (tx.toEntity || '-');

      const cells = journalCols.map(col => {
        if (col === 'Date') return dataCell(fmtDate(tx.date), shaded);
        if (col === 'Phase') return dataCell(tx.phase?.name || 'Project', shaded);
        if (col === 'From') return dataCell(resolvedFrom, shaded);
        if (col === 'To') return dataCell(resolvedTo, shaded);
        if (col === 'Category') return dataCell(primaryAccount, shaded);
        if (col === 'Description') return dataCell(pureDesc || '-', shaded);
        if (col === 'Amount') return dataCell(fmt(txAmount), shaded, true);
        if (col === 'Reference') return dataCell(tx.reference || '-', shaded);
        return dataCell('', shaded);
      });

      return new TableRow({ children: cells });
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    }));
  }

  // ══════════════════════════════════════════════════════════
  //  LEDGER (matches frontend — separate or combined mode)
  // ══════════════════════════════════════════════════════════
  if (sections.ledger && allAccounts.length > 0) {
    children.push(sectionHeading(`${nextHeadingNum(useRoman)}. General Ledger`));

    const ledgerCols: string[] = columns.ledger?.length
      ? columns.ledger
      : ['Date', 'Phase', 'Debit', 'Credit', 'Running Balance'];

    // Filter to specific accounts if requested
    const filterAccounts = (params.ledger_accounts?.length)
      ? (allAccounts as any[]).filter((a: any) => params.ledger_accounts!.includes(a.name))
      : allAccounts as any[];

    // Fetch ledger entries per account
    const ledgerMap: Record<string, any[]> = {};
    for (const account of filterAccounts) {
      const entries = await accountingService.getLedger(
        projectId, account.id,
        phaseIds?.length ? phaseIds : undefined,
      ).catch(() => []);

      const filtered = entries.filter((e: any) => {
        const d = new Date(e.date);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });

      if (filtered.length > 0) {
        ledgerMap[account.name] = filtered;
      }
    }

    if (params.combine_ledger_accounts) {
      // ── Combined: single table with "Account Name" column ──
      const allEntries: any[] = [];
      Object.entries(ledgerMap).forEach(([acc, entries]) => {
        entries.forEach(e => allEntries.push({ ...e, accountName: acc }));
      });
      allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const combinedCols = ['Date', 'Phase', 'Account Name', 'Debit', 'Credit', 'Running Balance']
        .filter(c => ledgerCols.includes(c) || c === 'Account Name');

      if (allEntries.length > 0) {
        const hRow = new TableRow({ tableHeader: true, children: combinedCols.map(c => headerCell(c)) });
        const dRows = allEntries.map((e, i) => {
          const sh = i % 2 === 0;
          const balStr = `${fmt(Math.abs(e.runningBalance))} ${getDrCr(e.runningBalance, e.accountType)}`;
          const cells = combinedCols.map(col => {
            if (col === 'Date') return dataCell(fmtDate(e.date), sh);
            if (col === 'Phase') return dataCell(e.phaseName || 'Project', sh);
            if (col === 'Account Name') return dataCell(e.accountName, sh);
            if (col === 'Debit') return dataCell(e.type === 'DEBIT' ? fmt(e.amount) : '-', sh, true);
            if (col === 'Credit') return dataCell(e.type === 'CREDIT' ? fmt(e.amount) : '-', sh, true);
            if (col === 'Running Balance') return dataCell(balStr, sh, true);
            return dataCell('', sh);
          });
          return new TableRow({ children: cells });
        });
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [hRow, ...dRows] }));
      }
    } else {
      // ── Separate table per account ──
      for (const [accName, entries] of Object.entries(ledgerMap)) {
        children.push(new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: `ACCOUNT: ${accName}`, bold: true, size: 22, color: '0f172a' })],
        }));

        const hRow = new TableRow({ tableHeader: true, children: ledgerCols.map(c => headerCell(c)) });
        const dRows = entries.map((e: any, i: number) => {
          const sh = i % 2 === 0;
          const balStr = `${fmt(Math.abs(e.runningBalance))} ${getDrCr(e.runningBalance, e.accountType)}`;
          const cells = ledgerCols.map(col => {
            if (col === 'Date') return dataCell(fmtDate(e.date), sh);
            if (col === 'Phase') return dataCell(e.phaseName || 'Project', sh);
            if (col === 'Debit') return dataCell(e.type === 'DEBIT' ? fmt(e.amount) : '-', sh, true);
            if (col === 'Credit') return dataCell(e.type === 'CREDIT' ? fmt(e.amount) : '-', sh, true);
            if (col === 'Running Balance') return dataCell(balStr, sh, true);
            return dataCell('', sh);
          });
          return new TableRow({ children: cells });
        });

        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [hRow, ...dRows] }));
        children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  //  TRIAL BALANCE
  // ══════════════════════════════════════════════════════════
  if (sections.trialBalance && trialBalanceData) {
    children.push(sectionHeading(`${nextHeadingNum(useRoman)}. Trial Balance`));

    const tbCols: string[] = columns.trialBalance?.length
      ? columns.trialBalance
      : ['Account Name', 'Debit Balance', 'Credit Balance'];

    const headerRow = new TableRow({
      tableHeader: true,
      children: tbCols.map(c => headerCell(c)),
    });

    const tbAccounts = Array.isArray((trialBalanceData as any).accounts)
      ? (trialBalanceData as any).accounts
      : Object.values((trialBalanceData as any).accounts || {});

    const dataRows: TableRow[] = (tbAccounts as any[]).map((acc: any, i: number) => {
      const shaded = i % 2 === 0;
      const bal = parseFloat(acc.balance || 0);
      const cells = tbCols.map(col => {
        if (col === 'Account Name') return dataCell(acc.name || '', shaded);
        if (col === 'Debit Balance') return dataCell(bal > 0 ? fmt(bal) : '0.00', shaded, true);
        if (col === 'Credit Balance') return dataCell(bal < 0 ? fmt(Math.abs(bal)) : '0.00', shaded, true);
        return dataCell('', shaded);
      });
      return new TableRow({ children: cells });
    });

    // Totals row
    const totals = (trialBalanceData as any).totals || {};
    const totalRow = new TableRow({
      children: tbCols.map(col => new TableCell({
        shading: { type: ShadingType.SOLID, color: 'e2e8f0' },
        borders: makeBorders(),
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({
            bold: true, size: 18,
            text: col === 'Account Name' ? 'TOTAL'
              : col === 'Debit Balance' ? fmt(totals.totalDebits || 0)
              : col === 'Credit Balance' ? fmt(totals.totalCredits || 0)
              : '',
          })],
        })],
      })),
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows, totalRow],
    }));
  }

  // ── Footer note ──────────────────────────────────────────
  if (params.show_footer_note && params.footer_note) {
    children.push(new Paragraph({
      spacing: { before: 400 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR } },
      children: [new TextRun({ text: params.footer_note, size: 16, italics: true, color: '64748b' })],
    }));
  }

  // ── Assemble & pack ──────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.75),
            bottom: convertInchesToTwip(0.75),
            left: convertInchesToTwip(0.9),
            right: convertInchesToTwip(0.9),
          },
        },
      },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
