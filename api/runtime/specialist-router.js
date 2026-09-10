"use strict";

const { SPECIALIST_ROLES } = require("./specialist-agent");

const KEYWORDS = Object.freeze({
  legal_research: ["law", "judgment", "case", "statute", "court", "legal", "precedent"],
  tax: ["tax", "gst", "income tax", "withholding", "transfer pricing", "customs"],
  accounting: ["accounting", "audit", "ledger", "financial statement", "ifrs", "gaap"],
  corporate: ["company", "corporate", "director", "shareholder", "merger", "acquisition", "incorporation"],
  compliance: ["compliance", "regulatory", "license", "filing", "aml", "kyc", "policy"],
  cross_border: ["cross-border", "cross border", "international", "foreign", "treaty", "india", "hong kong", "gulf"]
});

function createSpecialistRouter({ specialists } = {}) {
  if (!specialists || typeof specialists !== "object") throw new TypeError("Specialists are required");
  for (const role of SPECIALIST_ROLES) {
    if (!specialists[role] || typeof specialists[role].execute !== "function") {
      throw new TypeError(`Specialist is incomplete: ${role}`);
    }
  }

  function rank(task = "", context = {}) {
    const text = `${task} ${context.subject || ""} ${context.domain || ""}`.toLowerCase();
    return SPECIALIST_ROLES.map((role) => ({
      role,
      score: KEYWORDS[role].reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0)
    })).sort((a, b) => b.score - a.score || SPECIALIST_ROLES.indexOf(a.role) - SPECIALIST_ROLES.indexOf(b.role));
  }

  async function execute({ task, context = {}, ...input } = {}) {
    if (!task) throw new Error("Specialist task is required");
    const ranked = rank(task, context);
    const selected = context.specialistRole || ranked[0].role;
    if (!SPECIALIST_ROLES.includes(selected)) throw new Error(`Unsupported specialist role: ${selected}`);
    return specialists[selected].execute({ task, context: { ...context, routedSpecialistRole: selected }, ...input });
  }

  return Object.freeze({ roles: SPECIALIST_ROLES, rank, execute });
}

module.exports = { KEYWORDS, createSpecialistRouter };
