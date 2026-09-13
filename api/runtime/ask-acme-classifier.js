"use strict";

const MATTER_TYPES = Object.freeze([
  "civil", "criminal", "commercial", "corporate", "insolvency", "arbitration", "tax",
  "employment", "family", "property", "intellectual_property", "constitutional",
  "administrative", "regulatory", "consumer", "banking_finance", "cyber", "environment",
  "competition", "cross_border", "other"
]);

const KEYWORDS = Object.freeze({
  criminal: ["fir", "bail", "arrest", "accused", "criminal", "prosecution", "offence"],
  tax: ["gst", "income tax", "tax", "tds", "customs", "transfer pricing"],
  corporate: ["company", "director", "shareholder", "merger", "acquisition", "incorporation"],
  insolvency: ["insolvency", "ibc", "nclt", "creditor", "resolution plan", "liquidation"],
  arbitration: ["arbitration", "arbitral", "award", "section 34", "section 11"],
  employment: ["employee", "employment", "termination", "wages", "labour", "labour law"],
  family: ["divorce", "custody", "maintenance", "matrimonial", "family court"],
  property: ["property", "land", "lease", "rent", "sale deed", "title"],
  intellectual_property: ["trademark", "copyright", "patent", "design", "ip"],
  commercial: ["commercial dispute", "contract", "breach", "invoice", "recovery", "supply"],
  consumer: ["consumer", "deficiency", "consumer commission"],
  banking_finance: ["bank", "loan", "mortgage", "sarfaesi", "financial"],
  cyber: ["cyber", "data breach", "hacking", "information technology"],
  competition: ["competition", "cci", "anti-trust", "cartel"],
  environment: ["environment", "pollution", "ngt", "environmental"],
  cross_border: ["cross-border", "foreign", "international", "hong kong", "gulf"]
});

const JURISDICTIONS = Object.freeze({
  IN: ["india", "indian"],
  HK: ["hong kong"],
  AE: ["uae", "united arab emirates", "dubai", "abu dhabi"]
});

function createAskAcmeClassifier({ resolveAuthority = null, resolveInstrument = null } = {}) {
  async function classify({ question, jurisdiction = null, stateOrTerritory = null, courtOrForum = null, dateContext = null } = {}) {
    if (typeof question !== "string" || question.trim().length < 8) throw new Error("A substantive question is required");
    const text = question.toLowerCase();
    const detectedJurisdiction = jurisdiction || detectOne(text, JURISDICTIONS);
    const matterType = detectMatterType(text);
    const explicitSection = text.match(/\b(?:section|sec\.?|s\.)\s*\d+[a-z]?(?:\(\d+\))?/i)?.[0] || null;
    const authority = resolveAuthority ? await resolveAuthority({ jurisdiction: detectedJurisdiction, stateOrTerritory, courtOrForum, matterType, question }) : null;
    const instrument = resolveInstrument ? await resolveInstrument({ jurisdiction: detectedJurisdiction, matterType, question, explicitSection, dateContext }) : null;
    return Object.freeze({
      jurisdiction: detectedJurisdiction,
      stateOrTerritory,
      courtOrForum: courtOrForum || authority?.id || null,
      matterType,
      legalInstrument: instrument?.id || null,
      sectionOrRule: instrument?.sectionOrRule || explicitSection,
      issue: question.trim(),
      dateContext,
      authorityLevel: authority?.authorityType || null,
      confidence: { jurisdiction: Boolean(detectedJurisdiction), matterType: matterType !== "other", sourceBackedInstrument: Boolean(instrument) },
      requiresClarification: !detectedJurisdiction || matterType === "other" || !authority
    });
  }
  return Object.freeze({ classify, MATTER_TYPES });
}

function detectOne(text, taxonomy) {
  for (const [id, terms] of Object.entries(taxonomy)) if (terms.some((term) => text.includes(term))) return id;
  return null;
}

function detectMatterType(text) {
  const ranked = MATTER_TYPES.map((type) => ({ type, score: (KEYWORDS[type] || []).filter((term) => text.includes(term)).length }))
    .sort((a, b) => b.score - a.score || MATTER_TYPES.indexOf(a.type) - MATTER_TYPES.indexOf(b.type));
  return ranked[0]?.score ? ranked[0].type : "other";
}

module.exports = { MATTER_TYPES, createAskAcmeClassifier };
