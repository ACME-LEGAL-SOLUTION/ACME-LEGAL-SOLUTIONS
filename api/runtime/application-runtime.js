"use strict";

const { createRuntime } = require("./index");
const { createAIGateway } = require("./ai-gateway-runtime");
const { createSourceService } = require("./source-service");
const { createLegalVersionService } = require("./legal-version-service");
const { createAuthorityService } = require("./authority-service");
const { createDiaryService } = require("./diary-service");
const { createBillingService } = require("./billing-service");
const { createNetworkService } = require("./network-service");

function createApplicationRuntime({ repositories, provider, clock = () => new Date() } = {}) {
  if (!repositories) throw new Error("Application repositories are required");
  const runtime = createRuntime({ repositories, audit: repositories.auditService, clock });
  return Object.freeze({
    runtime,
    ai: createAIGateway({ repositories, provider, clock }),
    source: createSourceService({ repository: repositories.sources, clock }),
    legalVersions: createLegalVersionService({ repository: repositories.legalVersions, clock }),
    authorities: createAuthorityService({ repository: repositories.authorities, clock }),
    diary: createDiaryService({ repository: repositories.diary, audit: repositories.auditService, clock }),
    billing: createBillingService({ invoiceRepository: repositories.invoices, paymentRepository: repositories.payments, audit: repositories.auditService, clock }),
    network: createNetworkService({ repository: repositories.partners, audit: repositories.auditService, clock })
  });
}

module.exports = { createApplicationRuntime };
