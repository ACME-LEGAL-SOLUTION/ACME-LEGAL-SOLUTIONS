"use strict";

const { createAuditService } = require("./audit-service");
const { createReviewService } = require("./review-service");

function createGovernance({ repositories = {}, clock = () => new Date() } = {}) {
  if (!repositories.reviews || !repositories.audit) {
    throw new Error("Review and audit repositories are required");
  }
  const audit = createAuditService({ repository: repositories.audit, clock });
  const reviews = createReviewService({ repository: repositories.reviews, audit, clock });
  return Object.freeze({ audit, reviews });
}

module.exports = { createGovernance };
