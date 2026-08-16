export const apiRoutePolicy = Object.freeze({
  'api/catalog.mjs': 'read-only',
  'api/deal-qr.mjs': 'read-only',
  'api/health.mjs': 'read-only',
  'api/auth/login.mjs': 'shared-json-mutation',
  'api/auth/logout.mjs': 'shared-json-mutation',
  'api/auth/mfa.mjs': 'shared-json-mutation',
  'api/auth/password.mjs': 'shared-json-mutation',
  'api/auth/recover.mjs': 'shared-json-mutation',
  'api/auth/refresh.mjs': 'shared-same-origin',
  'api/auth/signup.mjs': 'shared-json-mutation',
  'api/security/mfa-recovery.mjs': 'shared-json-mutation',
  'api/vehicles/vin.mjs': 'shared-json-mutation',
  'api/security/client-failure.mjs': 'shared-reporting-boundary',
  'api/security/runtime-rejection.mjs': 'shared-reporting-boundary',
  'api/security/web-vital.mjs': 'shared-reporting-boundary',
  'api/security/csp-report.mjs': 'browser-reporting',
});

const requiredHandlerCalls = Object.freeze({
  'shared-same-origin': ['requirePost', 'requireSameOrigin'],
  'shared-json-mutation': ['requirePost', 'requireSameOrigin', 'requireJsonContentType'],
  'shared-reporting-boundary': ['validateReportingRequest', 'readBoundedJson'],
  'browser-reporting': ['readBody', 'reportsFromPayload'],
});

function inspectRouteSource(route, source) {
  const file = ts.createSourceFile(route, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const syntaxDiagnostics = file.parseDiagnostics ?? [];
  if (syntaxDiagnostics.length) return null;

  let handler;
  for (const statement of file.statements) {
    if (
      ts.isFunctionDeclaration(statement)
      && statement.name?.text === 'handler'
      && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)
      && statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      handler = statement;
      break;
    }
  }
  if (!handler?.body) return null;

  const inspect = root => {
    const calls = new Set();
    const identifiers = new Set();
    const strings = new Set();
    const properties = new Set();
    const visit = node => {
      if (ts.isIdentifier(node)) identifiers.add(node.text);
      if (ts.isStringLiteralLike(node)) strings.add(node.text);
      if (ts.isPropertyAccessExpression(node)) {
        properties.add(`${node.expression.getText(file)}.${node.name.text}`);
      }
      if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression)) calls.add(node.expression.text);
        if (ts.isPropertyAccessExpression(node.expression)) calls.add(node.expression.name.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(root);
    return { calls, identifiers, strings, properties };
  };

  return { program: inspect(file), handler: inspect(handler.body) };
}

export function evaluateApiMutationOriginPolicy(routeSources) {
  const findings = [];
  const actualRoutes = Object.keys(routeSources).sort();
  const expectedRoutes = Object.keys(apiRoutePolicy).sort();

  for (const route of actualRoutes) {
    if (!apiRoutePolicy[route]) findings.push({ route, issue: 'unreviewed_route' });
  }
  for (const route of expectedRoutes) {
    const source = routeSources[route];
    if (typeof source !== 'string') {
      findings.push({ route, issue: 'missing_route' });
      continue;
    }
    const mode = apiRoutePolicy[route];
    const semantics = inspectRouteSource(route, source);
    if (!semantics) {
      findings.push({ route, issue: 'invalid_handler_structure' });
      continue;
    }
    if (mode === 'read-only') {
      if (
        !semantics.handler.properties.has('request.method')
        || !semantics.handler.strings.has('GET')
      ) {
        findings.push({ route, issue: 'missing_read-only_control' });
      }
      continue;
    }
    for (const call of requiredHandlerCalls[mode]) {
      if (!semantics.handler.calls.has(call)) {
        findings.push({ route, issue: `missing_${mode}_control` });
      }
    }
    if (mode === 'browser-reporting') {
      if (
        !semantics.handler.properties.has('request.method')
        || !semantics.handler.strings.has('POST')
        || !semantics.handler.identifiers.has('allowedContentTypes')
        || !semantics.program.identifiers.has('maxBodyBytes')
      ) {
        findings.push({ route, issue: 'missing_browser-reporting_control' });
      }
    }
  }

  return {
    schema: 'dealivra.api-mutation-origin-policy.v1',
    status: findings.length ? 'failed' : 'passed',
    routesReviewed: expectedRoutes.length,
    findings,
  };
}
import ts from 'typescript';
