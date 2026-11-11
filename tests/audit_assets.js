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
console.log('Auditing ' + htmlFiles.length + ' HTML files for broken local script and stylesheet paths...');
let missingCount = 0;

for (const htmlPath of htmlFiles) {
  const content = fs.readFileSync(htmlPath, 'utf8');
  const dir = path.dirname(htmlPath);

  const scriptMatches = [...content.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi)];
  for (const m of scriptMatches) {
    const src = m[1];
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) continue;
    const cleanSrc = src.split('?')[0].split('#')[0];
    const resolved = path.resolve(dir, cleanSrc);
    if (!fs.existsSync(resolved)) {
      missingCount++;
      console.log('✖ Missing script in ' + htmlPath + ' -> ' + src);
    }
  }

  const linkMatches = [...content.matchAll(/<link\s+[^>]*href=["']([^"']+)["']/gi)];
  for (const m of linkMatches) {
    const href = m[1];
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//') || href.startsWith('data:')) continue;
    const cleanHref = href.split('?')[0].split('#')[0];
    const resolved = path.resolve(dir, cleanHref);
    if (!fs.existsSync(resolved)) {
      missingCount++;
      console.log('✖ Missing asset in ' + htmlPath + ' -> ' + href);
    }
  }
}

if (missingCount === 0) {
  console.log('✔ SUCCESS: All local scripts and assets across all ' + htmlFiles.length + ' HTML files exist and resolve cleanly!');
} else {
  console.error('Found ' + missingCount + ' missing assets.');
  process.exit(1);
}

