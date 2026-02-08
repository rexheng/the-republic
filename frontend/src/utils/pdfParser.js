// PDF Parser for academic papers
// Primary: Grobid API (S2ORC pipeline) → TEI XML → structured metadata
// Fallback: pdfjs-dist client-side text extraction + heuristics

import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const GROBID_URL = 'https://cloud.science-miner.com/grobid/api/processHeaderDocument';

// ============================================================
// Primary: Grobid API (S2ORC's extraction engine)
// ============================================================

async function parseWithGrobid(file) {
  const formData = new FormData();
  formData.append('input', file);
  formData.append('consolidateHeader', '1');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const res = await fetch(GROBID_URL, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!res.ok) throw new Error(`Grobid returned ${res.status}`);

  const xml = await res.text();
  return parseTeiXml(xml);
}

function parseTeiXml(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const tei = 'http://www.tei-c.org/ns/1.0';

  // Title
  const titleEl = doc.getElementsByTagNameNS(tei, 'title')[0];
  const title = titleEl?.textContent?.trim() || '';

  // Authors
  const authors = [];
  const persNames = doc.getElementsByTagNameNS(tei, 'persName');
  for (const pn of persNames) {
    const forenames = pn.getElementsByTagNameNS(tei, 'forename');
    const surname = pn.getElementsByTagNameNS(tei, 'surname')[0];
    const parts = [];
    for (const fn of forenames) parts.push(fn.textContent.trim());
    if (surname) parts.push(surname.textContent.trim());
    if (parts.length > 0) authors.push(parts.join(' '));
  }

  // Abstract
  const abstractEl = doc.getElementsByTagNameNS(tei, 'abstract')[0];
  let abstract = '';
  if (abstractEl) {
    const ps = abstractEl.getElementsByTagNameNS(tei, 'p');
    if (ps.length > 0) {
      abstract = Array.from(ps).map(p => p.textContent.trim()).join('\n\n');
    } else {
      abstract = abstractEl.textContent.trim();
    }
  }

  // DOI
  let doi = null;
  const idnos = doc.getElementsByTagNameNS(tei, 'idno');
  for (const idno of idnos) {
    if (idno.getAttribute('type') === 'DOI') {
      doi = idno.textContent.trim();
      break;
    }
  }

  // Year
  let year = null;
  const dates = doc.getElementsByTagNameNS(tei, 'date');
  for (const d of dates) {
    const when = d.getAttribute('when');
    if (when) {
      const match = when.match(/((?:19|20)\d{2})/);
      if (match) { year = parseInt(match[1]); break; }
    }
  }

  return { title, authors, year, abstract, doi, fieldsOfStudy: [] };
}

// ============================================================
// Fallback: pdfjs-dist client-side extraction + heuristics
// ============================================================

async function parseWithPdfjs(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Extract text with font sizes from first 3 pages
  const textItems = [];
  const pageCount = Math.min(pdf.numPages, 3);

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (item.str && item.str.trim()) {
        textItems.push({
          text: item.str.trim(),
          fontSize: Math.abs(item.transform?.[0] || 12),
          page: i,
        });
      }
    }
  }

  const fullText = textItems.map(t => t.text).join(' ');

  // Title: largest font text in first page
  const firstPageItems = textItems.filter(t => t.page === 1);
  let maxFontSize = 0;
  for (const item of firstPageItems) {
    if (item.fontSize > maxFontSize) maxFontSize = item.fontSize;
  }
  const titleParts = firstPageItems
    .filter(t => t.fontSize >= maxFontSize * 0.9)
    .slice(0, 5);
  const title = titleParts.map(t => t.text).join(' ').slice(0, 300);

  // DOI
  const doiMatch = fullText.match(/10\.\d{4,9}\/[^\s,;)]+/);
  const doi = doiMatch ? doiMatch[0].replace(/[.)]+$/, '') : null;

  // Year
  const yearMatch = fullText.slice(0, 2000).match(/((?:19|20)\d{2})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  // Abstract
  let abstract = '';
  const abstractIdx = fullText.toLowerCase().indexOf('abstract');
  if (abstractIdx !== -1) {
    const afterAbstract = fullText.slice(abstractIdx + 8, abstractIdx + 3000);
    // Take text until next section header
    const endMatch = afterAbstract.match(/\n\s*(?:1\s*\.?\s*Introduction|Keywords|I\.\s|CCS Concepts)/i);
    abstract = endMatch
      ? afterAbstract.slice(0, endMatch.index).trim()
      : afterAbstract.slice(0, 1500).trim();
  }

  // Authors: heuristic — text below title, above abstract, with commas
  const authors = [];
  const titleEnd = fullText.indexOf(title) + title.length;
  const authorsSection = fullText.slice(titleEnd, abstractIdx > titleEnd ? abstractIdx : titleEnd + 500);
  const authorCandidates = authorsSection
    .split(/,|(?:\sand\s)/)
    .map(s => s.trim())
    .filter(s => s.length > 2 && s.length < 60 && !s.match(/@|university|department|institute|\d{4}/i));
  authors.push(...authorCandidates.slice(0, 10));

  return { title, authors, year, abstract, doi, fieldsOfStudy: [] };
}

// ============================================================
// Main export: tries Grobid first, falls back to pdfjs
// ============================================================

export async function parsePdfFile(file) {
  // Try Grobid first (S2ORC pipeline)
  try {
    const result = await parseWithGrobid(file);
    if (result.title) {
      result._method = 'grobid';
      return result;
    }
  } catch (e) {
    console.warn('Grobid unavailable, falling back to pdfjs:', e.message);
  }

  // Fallback to client-side pdfjs extraction
  try {
    const result = await parseWithPdfjs(file);
    result._method = 'pdfjs';
    return result;
  } catch (e) {
    console.error('PDF parsing failed:', e);
    return {
      title: file.name.replace(/\.pdf$/i, ''),
      authors: [],
      year: null,
      abstract: '',
      doi: null,
      fieldsOfStudy: [],
      _method: 'filename',
    };
  }
}
