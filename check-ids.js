const fs = require('fs');
const content = fs.readFileSync('js/app.js', 'utf8');
const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
let m;
const ids = new Set();
while ((m = regex.exec(content)) !== null) {
  ids.add(m[1]);
}
const html = fs.readFileSync('index.html', 'utf8');
const missing = [];
for (const id of ids) {
  if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
    missing.push(id);
  }
}
console.log('Total IDs found in app.js:', ids.size);
console.log('Missing IDs in index.html:', missing);
