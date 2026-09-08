"use strict";

function createConsultationService({ intake, clock = () => new Date() } = {}) {
  if (!intake?.start) throw new Error("Intake service is required");

  async function submit(input, actor) {
    if (!actor?.id) throw new Error("Authenticated actor is required");
    if (!input?.name?.trim()) throw new Error("Name is required");
    if (!input?.email?.trim()) throw new Error("Email is required");
    if (!input?.summary?.trim()) throw new Error("Matter summary is required");

    const result = await intake.start({
      client: {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        source: input.source || "website"
      },
      matter: {
        title: input.subject?.trim() || "Professional consultation",
        summary: input.summary.trim(),
        jurisdiction: input.jurisdiction?.trim() || null,
        urgency: input.urgency || "standard",
        requestedAt: clock().toISOString()
      }
    }, actor);

    return {
      clientId: result.client.id,
      matterId: result.matter.id,
      intakeState: result.intakeState,
      message: "Your consultation request has been received. ACME will route it to the appropriate professional workflow."
    };
  }

  return Object.freeze({ submit });
}

module.exports = { createConsultationService };
