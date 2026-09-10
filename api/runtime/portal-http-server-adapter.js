"use strict";

const { createPortalHttpRoutes, invokePortalRoute, CLIENT_PATH, PROFESSIONAL_PATH } = require("./portal-http-routes");

function extendPortalOperations(operations) {
  return Object.freeze({ ...operations, [CLIENT_PATH]: { GET: ["dashboard"] }, [PROFESSIONAL_PATH]: { GET: ["workspace"] } });
}

function createPortalInvoker(portal) {
  const routes = createPortalHttpRoutes({ portal });
  return (path, input, actor) => invokePortalRoute(routes, path, input, actor);
}

module.exports = { CLIENT_PATH, PROFESSIONAL_PATH, extendPortalOperations, createPortalInvoker };
