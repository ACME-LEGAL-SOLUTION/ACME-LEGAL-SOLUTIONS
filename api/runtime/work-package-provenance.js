"use strict";

function attachProvenance(workPackage, provenance = []) {
  if (!Array.isArray(provenance)) throw new TypeError("provenance must be an array");
  return Object.freeze({
    ...workPackage,
    provenance: [...workPackage.provenance, ...provenance],
    version: workPackage.version + 1,
    updatedAt: new Date().toISOString(),
    audit: [...workPackage.audit, { action: "provenance_attached", at: new Date().toISOString(), count: provenance.length }]
  });
}

module.exports = { attachProvenance };
