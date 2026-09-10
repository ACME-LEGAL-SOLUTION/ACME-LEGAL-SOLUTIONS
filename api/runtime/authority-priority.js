"use strict";

const AUTHORITY_PRIORITY = Object.freeze({
  legislation: 1,
  regulation: 2,
  supreme_court: 3,
  appellate_court: 4,
  tribunal: 5,
  administrative: 6,
  secondary: 7
});

function rankAuthorities(authorities = []) {
  if (!Array.isArray(authorities)) throw new TypeError("Authorities must be an array");
  return authorities.map((authority, index) => ({ authority, index, priority: AUTHORITY_PRIORITY[authority.authorityType] || 99 }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ authority }) => authority);
}

module.exports = { AUTHORITY_PRIORITY, rankAuthorities };
