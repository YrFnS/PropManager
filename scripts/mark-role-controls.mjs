import fs from 'node:fs';
import ts from 'typescript';

const targets = new Map([
  ['src/components/properties/properties-section.tsx', 'properties'],
  ['src/components/units/units-section.tsx', 'units'],
  ['src/components/tenants/tenants-section.tsx', 'tenants'],
  ['src/components/maintenance/maintenance-section.tsx', 'maintenance'],
  ['src/components/messages/messages-section.tsx', 'messages'],
]);

const mutationPattern = /(add|create|edit|delete|remove|submit|save|markall|markread|toggleRead|openAdd|openEdit|handleOpen|handleDelete|setDelete|setBulkDelete|handleSubmit|markPaid|updateStatus)/i;
const readOnlyPattern = /(export|receipt|detail|view|search|filter|openReceipt|handlePeriod|toggleSidebar|previous|next|pagination|clearSelection|selectAll)/i;

function tagName(node, source) {
  return node.tagName.getText(source);
}

function hasMarker(node) {
  return node.attributes.properties.some(
    (property) => ts.isJsxAttribute(property) && property.name.getText() === 'data-pm-write-resource',
  );
}

function shouldMark(node, source, resource) {
  if (hasMarker(node)) return false;
  const tag = tagName(node, source);
  const opening = node.getText(source);

  if (tag === 'AlertDialogAction') return true;
  if (tag === 'Checkbox' && resource === 'units') return true;
  if (tag === 'TabsTrigger' && resource === 'maintenance' && /value=["']board["']/.test(opening)) return true;
  if (tag !== 'Button') return false;
  if (/type=["']submit["']/.test(opening)) return true;
  if (!/onClick=/.test(opening)) return false;
  if (readOnlyPattern.test(opening)) return false;
  return mutationPattern.test(opening);
}

for (const [file, resource] of targets) {
  if (!fs.existsSync(file)) throw new Error(`Missing target ${file}`);
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];

  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      shouldMark(node, source, resource)
    ) {
      edits.push({ position: node.tagName.getEnd(), value: ` data-pm-write-resource="${resource}"` });
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  if (edits.length === 0 && !text.includes(`data-pm-write-resource="${resource}"`)) {
    throw new Error(`No mutation controls were identified in ${file}`);
  }

  let next = text;
  for (const edit of edits.sort((left, right) => right.position - left.position)) {
    next = `${next.slice(0, edit.position)}${edit.value}${next.slice(edit.position)}`;
  }

  const marker = `data-pm-write-resource="${resource}"`;
  if (!next.includes(marker)) throw new Error(`Permission marker was not written to ${file}`);
  fs.writeFileSync(file, next);
  console.log(`${file}: tagged ${edits.length} mutation controls`);
}
