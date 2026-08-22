import * as ts from 'typescript';

function importsLaunchTranslator(sourceFile) {
  return sourceFile.statements.some(statement => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      return false;
    }
    const modulePath = statement.moduleSpecifier.text.replaceAll('\\', '/');
    const bindings = statement.importClause?.namedBindings;
    if (!/(^|\/)i18n$/.test(modulePath) || !bindings || !ts.isNamedImports(bindings)) {
      return false;
    }
    return bindings.elements.some(element => (element.propertyName ?? element.name).text === 't');
  });
}

export function inlineEnglishTranslationCalls(source, fileName = 'module.tsx') {
  if (typeof source !== 'string') return source;
  const scriptKind = /x(?:$|\?)/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind);
  if (!importsLaunchTranslator(sourceFile)) return source;

  const edits = [];
  const visit = node => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't' &&
      node.arguments.length === 1
    ) {
      const argument = node.arguments[0];
      const argumentSource = source.slice(argument.getStart(sourceFile), argument.end);
      const isPrimaryLiteral = ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument);
      edits.push({
        start: node.getStart(sourceFile),
        end: node.end,
        replacement: isPrimaryLiteral ? argumentSource : `(${argumentSource})`,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return edits
    .sort((left, right) => right.start - left.start)
    .reduce(
      (result, edit) =>
        `${result.slice(0, edit.start)}${edit.replacement}${result.slice(edit.end)}`,
      source,
    );
}

export function launchLocaleInliningPlugin() {
  return {
    name: 'dealivra-launch-locale-inlining',
    enforce: 'pre',
    transform(source, id) {
      if (!/\.[cm]?[jt]sx?$/.test(id) || id.includes('/node_modules/')) return null;
      const code = inlineEnglishTranslationCalls(source, id);
      return code === source ? null : { code, map: null };
    },
  };
}
