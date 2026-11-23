/** Inventory authored interface-copy candidates without opening accounts, databases, or runtime secrets.
 * This is a review aid, not an automatic language-quality or accessibility certification.
 * Usage: node scripts/audit-ux-copy.mts [--output /path/to/report.json]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const files = execFileSync('git', ['ls-files', '-z', '--', 'src', 'public', 'extensions'], { encoding: 'utf8' })
  .split('\0').filter(file => /\.(?:tsx?|mts|cts|html)$/.test(file));
const copyProperties = new Set(['title', 'label', 'description', 'placeholder', 'aria-label', 'alt', 'message', 'error', 'emptyLabel', 'loadingLabel', 'confirmLabel', 'cancelLabel', 'tooltip']);
type Candidate = { line: number; kind: string; text: string };
const records: { path: string; sha256: string; candidates: Candidate[] }[] = [];
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  const candidates: Candidate[] = [];
  if (path.endsWith('.html')) {
    const visible = source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    for (const match of visible.matchAll(/>([^<>]*[가-힣A-Za-z][^<>]*)</g)) {
      const text = match[1].replace(/\s+/g, ' ').trim();
      if (text) candidates.push({ line: 0, kind: 'HtmlText', text });
    }
  } else {
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if (ts.isJsxText(node) || ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        const text = node.text.replace(/\s+/g, ' ').trim();
        const parent = node.parent;
        const name = ts.isJsxAttribute(parent) || ts.isPropertyAssignment(parent) ? parent.name.getText(tree).replace(/^["']|["']$/g, '') : '';
        if (text && (/[가-힣]/.test(text) || (ts.isJsxText(node) || copyProperties.has(name)) && /[A-Za-z]/.test(text))) {
          candidates.push({ line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, kind: ts.SyntaxKind[node.kind], text });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  records.push({ path, sha256: createHash('sha256').update(source).digest('hex'), candidates });
}
const report = {
  scope: 'Tracked authored web source and first-party HTML; dynamic user content, upstream messages, generated/vendor assets and native-app resources require separate review.',
  note: 'Candidates include machine keys, prompts and examples for explicit exclusion; a scan does not establish that a phrase has been human-reviewed.',
  filesScanned: records.length,
  filesWithCandidates: records.filter(file => file.candidates.length).length,
  candidates: records.reduce((sum, file) => sum + file.candidates.length, 0),
  files: records,
};
const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === '--output')) throw Error('Usage: audit-ux-copy.mts [--output PATH]');
if (args[0] === '--output') writeFileSync(args[1], JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ filesScanned: report.filesScanned, filesWithCandidates: report.filesWithCandidates, candidates: report.candidates }));
