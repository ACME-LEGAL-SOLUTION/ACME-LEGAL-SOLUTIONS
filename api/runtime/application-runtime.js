"use strict";

const { createRuntime } = require("./index");
const { createAIGateway } = require("./ai-gateway-runtime");
const { SPECIALIST_ROLES, createSpecialistAgent } = require("./specialist-agent");
const { createSpecialistRouter } = require("./specialist-router");
const { createKnowledgeAccessGateway } = require("./knowledge-access-gateway");
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
const { createPortalService } = require("./portal-service");
const { createPortalMatterService } = require("./portal-matter-service");

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
  const source = createSourceService({ repository: repositories.sources, clock });
  const legalVersions = createLegalVersionService({ repository: repositories.legalVersions, clock });
  const authorities = createAuthorityService({ repository: repositories.authorities, clock });
  const knowledge = createKnowledgeAccessGateway({ sources: source, legalVersions, authorities, evidence });
  const specialists = Object.freeze(Object.fromEntries(SPECIALIST_ROLES.map((role) => [role, createSpecialistAgent({ role, provider, knowledgeGateway: knowledge, clock })])));
  const specialistRouter = createSpecialistRouter({ specialists });
  const ai = createAIGateway({ repositories, provider, specialistAgent: specialists.legal_research, clock });
  const diary = createDiaryService({ repository: repositories.diary, audit: repositories.auditService, clock });
  const billing = createBillingService({ invoiceRepository: repositories.invoices, paymentRepository: repositories.payments, audit: repositories.auditService, clock });
  const network = createNetworkService({ repository: repositories.partners, audit: repositories.auditService, clock });
  const portal = createPortalService({ crm, document, evidence, diary, billing, repositories });
  const portalMatter = createPortalMatterService({ crm, document, evidence, diary, repositories, clock });
  return Object.freeze({
    runtime, crm, intake, consultation, party, relationship, conflict, document, evidence, ai, specialists, specialistRouter, knowledge,
    reviews: ai.governance.reviews,
    source, legalVersions, authorities,
    diary, billing, network, portal, portalMatter
  });
}

module.exports = { createApplicationRuntime };
