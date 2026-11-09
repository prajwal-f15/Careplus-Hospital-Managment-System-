const fs = require('fs');
const path = require('path');

function getHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (item !== '.git' && item !== 'node_modules') {
        results = results.concat(getHtmlFiles(full));
      }
    } else if (item.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

const htmlFiles = getHtmlFiles('.');
console.log('======================================================================');
console.log('AUDITING MOBILE RESPONSIVENESS ACROSS ' + htmlFiles.length + ' HTML PAGES');
console.log('======================================================================\n');

let issues = [];

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');

  // 1. Viewport Meta Tag
  const hasViewport = /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width/i.test(content);
  if (!hasViewport) {
    issues.push({ file, rule: 'Missing viewport meta tag for mobile scaling' });
  }

  // 2. Unwrapped Table Horizontal Overflow Check
  const tableMatches = [...content.matchAll(/<table[\s\S]*?<\/table>/gi)];
  for (const match of tableMatches) {
    const tableIndex = match.index;
    const surrounding = content.substring(Math.max(0, tableIndex - 300), tableIndex);
    const isWrappedInOverflow = /overflow-x-auto/i.test(surrounding);
    if (!isWrappedInOverflow) {
      issues.push({ file, rule: 'Table found without overflow-x-auto container wrapper' });
    }
  }

  // 3. Modals Overflow Check
  const modalMatches = [...content.matchAll(/id=["']([^"']*(?:modal|scanner|dialog)[^"']*)["'][^>]*class=["']([^"']*)["']/gi)];
  for (const m of modalMatches) {
    const modalId = m[1];
    const modalClasses = m[2];
    if (modalClasses.includes('fixed') && !content.includes('overflow-y-auto') && !content.includes('max-h-')) {
      issues.push({ file, rule: `Modal #${modalId} might clip on small screens: missing max-h or overflow-y-auto` });
    }
  }
}

if (issues.length === 0) {
  console.log('✔ PASS: All ' + htmlFiles.length + ' HTML files satisfy mobile viewport scaling, responsive table wrapping, and modal responsiveness constraints!');
} else {
  console.log('Found ' + issues.length + ' potential responsiveness issues:');
  issues.forEach(i => console.log('  ⚠ ' + i.file + ' : ' + i.rule));
}
