import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

/**
 * Guard: user-facing copy must come from the text catalog (`t()`), not from literals in the screens.
 * It scans every non-test .ts/.tsx under app/ and src/ and reports `file:line` for
 *  - JSX text containing a letter,
 *  - string literals in copy props (title, label, placeholder, ...),
 *  - any string/template literal with a Romanian diacritic or a standalone Romanian stop word.
 * Suppress a deliberate hit with `// texts-ignore` on the same line or the line above.
 */

const ROOT = path.resolve(__dirname, '../..'); // apps/mobile

/** Files not migrated yet (relative to apps/mobile). Each batch removes its files; the last one leaves it empty. */
export const PENDING_FILES: string[] = [
  'src/screens/DeleteAccountInfoScreen.tsx',
  'src/screens/ReferralsInfoScreen.tsx',
];

/** Legal pages: the Terms/Privacy body text stays out of the editable catalog. */
const EXCLUDED_FILES = [
  'app/termeni.tsx',
  'app/confidentialitate.tsx',
  'src/screens/TermsScreen.tsx',
  'src/screens/PrivacyScreen.tsx',
  'src/screens/legal/LegalSection.tsx', // operator details of the legal pages (legal body)
];

const COPY_PROPS = new Set([
  'title', 'label', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'message', 'description',
  'subtitle', 'cta', 'confirmLabel', 'cancelLabel',
]);
const DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;
const STOP_WORDS = /(?<![\p{L}\p{N}_-])(și|sau|nu|la|din|cu|pentru|ai|să)(?![\p{L}\p{N}_-])/u;

function listFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__mocks__' || entry.name === 'node_modules') continue;
      listFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  }
  return out;
}

/** True when the expression is (a branch of) the value of a copy prop or of a copy-named object property. */
function isCopyPropValue(node: ts.Node): boolean {
  let child: ts.Node = node;
  for (let p: ts.Node | undefined = node.parent; p; child = p, p = p.parent) {
    if (ts.isJsxAttribute(p)) return COPY_PROPS.has(p.name.getText());
    if (ts.isPropertyAssignment(p)) return p.initializer === child && COPY_PROPS.has(p.name.getText().replace(/['"]/g, ''));
    if (ts.isJsxExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p)) continue;
    if (ts.isConditionalExpression(p) && p.condition !== child) continue;
    if (ts.isBinaryExpression(p)) {
      const op = p.operatorToken.kind;
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) continue;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken && p.right === child) continue;
    }
    return false;
  }
  return false;
}

function isConsoleCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'console'
  );
}

/** True when the literal sits where developer-only or non-copy strings live. */
function isAllowedContext(node: ts.Node): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isImportTypeNode(p)) return true;
    if (ts.isTypeNode(p)) return true;
    if (isConsoleCall(p)) return true;
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 'require') return true;
    if (ts.isJsxAttribute(p) && p.name.getText() === 'testID') return true;
    if (ts.isPropertyAssignment(p) && p.name.getText().replace(/['"]/g, '') === 'testID') return true;
    if (ts.isStatement(p) || ts.isArrowFunction(p) || ts.isFunctionLike(p)) return false;
  }
  return false;
}

function scan(file: string): string[] {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines = text.split(/\r?\n/);
  const hits: string[] = [];
  const report = (node: ts.Node, why: string) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line; // 0-based
    if (/texts-ignore/.test(lines[line] ?? '') || /texts-ignore/.test(lines[line - 1] ?? '')) return;
    hits.push(`${file}:${line + 1} ${why}`);
  };
  const checkString = (node: ts.Node, value: string, inCopyProp: boolean) => {
    if (!value.trim()) return;
    if (isAllowedContext(node)) return;
    if (/^[/(]/.test(value)) return; // route paths
    if (inCopyProp && /\p{L}/u.test(value)) return report(node, `copy prop literal ${JSON.stringify(value)}`);
    if (DIACRITICS.test(value) || STOP_WORDS.test(value)) report(node, `Romanian literal ${JSON.stringify(value)}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (/\p{L}/u.test(node.text)) report(node, `JSX text ${JSON.stringify(node.text.trim())}`);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const isKey = ts.isPropertyAssignment(parent) && parent.name === node;
      const inCopyProp = !isKey && isCopyPropValue(node);
      if (!isKey) checkString(node, node.text, inCopyProp);
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
      checkString(node, parts, isCopyPropValue(node));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe('no UI text literals outside the catalog', () => {
  const all = [...listFiles(path.join(ROOT, 'app')), ...listFiles(path.join(ROOT, 'src'))];

  it('EXCLUDED_FILES entries exist', () => {
    expect(EXCLUDED_FILES.filter((f) => !all.includes(f))).toEqual([]);
  });

  it('PENDING_FILES has no stale entries', () => {
    const stale = PENDING_FILES.filter((f) => !all.includes(f) || EXCLUDED_FILES.includes(f));
    expect(stale).toEqual([]);
  });

  it('migrated files contain no copy literals', () => {
    const skip = new Set([...PENDING_FILES, ...EXCLUDED_FILES]);
    const hits = all.filter((f) => !skip.has(f)).flatMap(scan);
    expect(hits).toEqual([]);
  });

  it('pending files still have literals (remove migrated files from PENDING_FILES)', () => {
    const clean = PENDING_FILES.filter((f) => scan(f).length === 0);
    expect(clean).toEqual([]);
  });
});
