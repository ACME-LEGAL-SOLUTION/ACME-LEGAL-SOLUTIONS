"use strict";

const DEFAULT_INDIACODE_BASE = "https://indiacode.ecourtsindia.com/api/v1";

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function classifyQuery(query) {
  const text = normalizeText(query);
  const lower = text.toLowerCase();
  const section = (text.match(/(?:section|sec\.?|s\.)\s*([0-9]+[A-Za-z-]*(?:\([^)]+\))?)/i) || [])[1] || null;
  const acts = [
    ["Negotiable Instruments Act, 1881", /negotiable instruments|cheque|dishonou?r|section 138/i],
    ["Bharatiya Nyaya Sanhita, 2023", /bharatiya nyaya sanhita|\bbns\b|criminal offence|murder|cheating|criminal breach/i],
    ["Bharatiya Nagarik Suraksha Sanhita, 2023", /bharatiya nagarik suraksha sanhita|\bbnss\b|criminal procedure|bail|fir|remand/i],
    ["Bharatiya Sakshya Adhiniyam, 2023", /bharatiya sakshya adhiniyam|\bbsa\b|evidence|admissibility|electronic record/i],
    ["Code of Civil Procedure, 1908", /civil procedure|\bcpc\b|plaint|written statement|injunction|execution/i],
    ["Companies Act, 2013", /companies act|company|oppression|mismanagement|director|shareholder/i],
    ["Insolvency and Bankruptcy Code, 2016", /insolvency|bankruptcy|\bibc\b|nclt|corporate insolvency/i]
  ];
  const act = acts.find(([, pattern]) => pattern.test(lower))?.[0] || null;
  const state = /maharashtra|mumbai/i.test(lower) ? "Maharashtra" : null;
  const court = /supreme court|\bsc\b/i.test(lower) ? "Supreme Court of India" : /high court|bombay high court|mumbai high court/i.test(lower) ? "High Court" : /nclt/i.test(lower) ? "NCLT" : null;
  const matterType = /cheque|dishonou?r/i.test(lower) ? "cheque dishonour" : /bail|fir|remand|criminal/i.test(lower) ? "criminal" : /divorce|matrimonial|maintenance/i.test(lower) ? "family" : /company|shareholder|director|nclt|insolvency/i.test(lower) ? "corporate" : /contract|agreement|breach/i.test(lower) ? "commercial" : /property|land|tenant|rent/i.test(lower) ? "property" : null;
  return { query: text, jurisdiction: "IN", state, court, matterType, act, section };
}

function scoreRecord(record, query) {
  const haystack = normalizeText([record.name, record.title, record.short_title, record.description, record.text].join(" ")).toLowerCase();
  const normalizedQuery = normalizeText(query).toLowerCase();
  const terms = normalizedQuery.split(/[^a-z0-9]+/).filter((x) => x.length > 2);
  let score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);

  // Legal queries often use the fact pattern while the primary source uses the
  // statutory act name. Award one deterministic act-family bonus rather than
  // pretending that "cheque" or "dishonour" must appear verbatim in the title.
  const chequeDishonourQuery = /\b(?:cheque|dishonou?r)\b/.test(normalizedQuery);
  const negotiableInstrumentsRecord = /negotiable\s+instruments\s+act/.test(haystack);
  if (chequeDishonourQuery && negotiableInstrumentsRecord) score += 1;

  return score;
}

async function requestJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Legal source request failed: ${response.status}`);
  return response.json();
}

async function searchIndiaCode({ query, limit = 10, fetchImpl = fetch, baseUrl = DEFAULT_INDIACODE_BASE } = {}) {
  const classification = classifyQuery(query);
  const params = new URLSearchParams({ q: classification.query, limit: String(Math.min(Math.max(limit, 1), 50)) });
  if (classification.act) params.set("act", classification.act);
  if (classification.section) params.set("section", classification.section);
  const data = await requestJson(`${baseUrl}/acts?${params.toString()}`, fetchImpl);
  const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : [];
  const results = items.map((record) => ({ ...record, score: scoreRecord(record, classification.query), provenance: { source: "India Code", sourceType: "public_primary", verification: "source_returned", retrievedAt: new Date().toISOString() } })).sort((a, b) => b.score - a.score).slice(0, limit);
  return { classification, source: "india-code", results };
}

module.exports = { DEFAULT_INDIACODE_BASE, classifyQuery, scoreRecord, searchIndiaCode };
