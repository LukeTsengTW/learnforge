import fs from 'node:fs'
import path from 'node:path'
import { error, log } from 'node:console'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entryPoint = path.join(repositoryRoot, 'supabase/functions/submit-quiz/index.ts')
const pending = [entryPoint]
const visited = new Set()
const violations = []

function repositoryPath(filePath) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join('/')
}

function isInsideRepository(filePath) {
  const relative = path.relative(repositoryRoot, filePath)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

function isTypeScriptPath(filePath) {
  return /\.tsx?$|\.mts$|\.cts$/i.test(filePath)
}

function resolveTypeScriptTarget(fromFile, specifier) {
  const unresolvedPath = path.resolve(path.dirname(fromFile), specifier)
  const extension = path.extname(unresolvedPath).toLowerCase()
  const candidates = extension
    ? extension === '.js'
      ? [unresolvedPath.replace(/\.js$/i, '.ts'), unresolvedPath.replace(/\.js$/i, '.tsx')]
      : extension === '.jsx'
        ? [unresolvedPath.replace(/\.jsx$/i, '.tsx'), unresolvedPath.replace(/\.jsx$/i, '.ts')]
        : isTypeScriptPath(unresolvedPath)
          ? [unresolvedPath]
          : []
    : [
        `${unresolvedPath}.ts`,
        `${unresolvedPath}.tsx`,
        path.join(unresolvedPath, 'index.ts'),
        path.join(unresolvedPath, 'index.tsx'),
      ]

  return candidates.find((candidate) => isInsideRepository(candidate) && fs.existsSync(candidate)) ?? null
}

function collectModuleSpecifiers(sourceFile) {
  const references = []

  function add(node, moduleSpecifier) {
    if (ts.isStringLiteralLike(moduleSpecifier)) {
      references.push({ node, specifier: moduleSpecifier.text })
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) add(node, node.moduleSpecifier)
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node, node.argument.literal)
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
    ) {
      add(node, node.arguments[0])
    } else if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'require'
      && node.arguments.length === 1
    ) {
      add(node, node.arguments[0])
    } else if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
    ) {
      add(node, node.moduleReference.expression)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return references
}

while (pending.length > 0) {
  const filePath = pending.pop()
  if (!filePath || visited.has(filePath)) continue
  visited.add(filePath)

  if (!isInsideRepository(filePath) || !fs.existsSync(filePath) || !isTypeScriptPath(filePath)) continue

  const source = fs.readFileSync(filePath, 'utf8')
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind)

  for (const { node, specifier } of collectModuleSpecifiers(sourceFile)) {
    if (!specifier.startsWith('.')) continue

    const target = resolveTypeScriptTarget(filePath, specifier)
    if (!target) continue

    if (!isTypeScriptPath(specifier)) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      violations.push({
        file: repositoryPath(filePath),
        line: position.line + 1,
        column: position.character + 1,
        specifier,
        target: repositoryPath(target),
      })
    }

    pending.push(target)
  }
}

log(`Scanned ${visited.size} Edge-reachable TypeScript modules from ${repositoryPath(entryPoint)}.`)

if (violations.length > 0) {
  for (const violation of violations) {
    error(
      `${violation.file}:${violation.line}:${violation.column} uses extensionless/non-TypeScript path `
      + `'${violation.specifier}' for TypeScript target ${violation.target}; add the explicit .ts extension.`,
    )
  }
  process.exitCode = 1
} else {
  log('PASS: all Edge-reachable project-local TypeScript imports use explicit .ts/.tsx paths.')
}
