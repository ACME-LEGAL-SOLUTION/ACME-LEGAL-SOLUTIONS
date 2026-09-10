"use strict";

// Compatibility boundary for production bootstrap/integration consumers.
// The provider-neutral implementation lives in driver-factory; this module
// gives production code one explicit, stable entry point.
const { createProductionDriver } = require("./driver-factory");

module.exports = { createProductionDriver };
