"use strict";

const { createRuntime } = require("./index");
const { createAIGateway } = require("./ai-gateway-runtime");
const { SPECIALIST_ROLES, createSpecialistAgent } = require("./specialist-agent");
const { createSourceService } = require("./source-service");
const { createLegalVersionService } = require("./legal-version-service");
const { createAuthorityService } = require("./authority-service");
const { createDiaryService } = require("./diary-service");
const { createBillingService } = require("./billing-service");
const { createNetworkService } = require("./network-service");
const { createCrmService } = require("./crm-service");
const { createIntakeService } = require("./intake-service");
const { createConsultationService } = require("./consultation-service");
const { createPartyService } = require("./party-service");
const { createRelationshipService } = require("./relationship-service");
const { createConflictService } = require("./conflict-service");
const { createDocumentService } = require("./document-service");
const { createEvidenceService } = require("./evidence-service");

function createApplicationRuntime({ repositories, provider, clock = () => new Date(), conflictCheck = null } = {}) {
  if (!repositories) throw new Error("Application repositories are required");
  const runtime = createRuntime({ repositories, audit: repositories.auditService, clock });
  const crm = createCrmService({ repositories, clock });
  const party = createPartyService({ repositories, clock });
  const relationship = createRelationshipService({ repositories, clock });
  const conflict = createConflictService({ repositories, clock });
  const document = createDocumentService({ repositories, clock });
  const evidence = createEvidenceService({ repositories, clock });
  const intake = createIntakeService({ repositories, clock, conflictCheck });
  const consultation = createConsultationService({ intake, clock });
  const specialists = Object.freeze(Object.fromEntries(SPECIALIST_ROLES.map((role) => [role, createSpecialistAgent({ role, provider, clock })])));
  const ai = createAIGateway({ repositories, provider, specialistAgent: specialists.legal_research, clock });
  return Object.freeze({
    runtime, crm, intake, consultation, party, relationship, conflict, document, evidence, ai, specialists,
    reviews: ai.governance.reviews,
    source: createSourceService({ repository: repositories.sources, clock }),
    legalVersions: createLegalVersionService({ repository: repositories.legalVersions, clock }),
    authorities: createAuthorityService({ repository: repositories.authorities, clock }),
    diary: createDiaryService({ repository: repositories.diary, audit: repositories.auditService, clock }),
    billing: createBillingService({ invoiceRepository: repositories.invoices, paymentRepository: repositories.payments, audit: repositories.auditService, clock }),
    network: createNetworkService({ repository: repositories.partners, audit: repositories.auditService, clock })
  });
}

module.exports = { createApplicationRuntime };
