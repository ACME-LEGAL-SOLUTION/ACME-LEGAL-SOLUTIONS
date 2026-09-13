"use strict";

const { searchIndiaCode } = require("./free-source-retrieval");

const MAX_QUERY_LENGTH = 2000;

function validateQuery(value) {
  const query = String(value || "").trim();
  if (!query) throw Object.assign(new Error("Legal research query is required"), { statusCode: 400 });
  if (query.length > MAX_QUERY_LENGTH) throw Object.assign(new Error(`Legal research query exceeds ${MAX_QUERY_LENGTH} characters`), { statusCode: 400 });
  return query;
}

async function handleLegalResearch(url, response, json, { search = searchIndiaCode } = {}) {
  if (url.searchParams.get("q") === null) return json(response, 400, { error: "Query parameter 'q' is required" });
  try {
    const query = validateQuery(url.searchParams.get("q"));
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 10), 1), 10);
    const result = await search({ query, limit });
    return json(response, 200, {
      query,
      classification: result.classification,
      source: result.source,
      results: result.results,
      disclaimer: "Research results are source-retrieval output for professional verification; they are not legal advice."
    });
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 502;
    return json(response, status, { error: error.message || "Legal research source unavailable" });
  }
}

module.exports = { MAX_QUERY_LENGTH, validateQuery, handleLegalResearch };