const fs = require('fs');
const path = require('path');

function fixContrast(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // text-slate-400 -> text-slate-500
  content = content.replace(/(?<!dark:)text-slate-400/g, 'text-slate-500');
  
  // text-slate-500 -> text-slate-600
  content = content.replace(/(?<!dark:)text-slate-500/g, 'text-slate-600');
  
  // text-gray-400 -> text-gray-500
  content = content.replace(/(?<!dark:)text-gray-400/g, 'text-gray-500');
  
  // text-gray-500 -> text-gray-600
  content = content.replace(/(?<!dark:)text-gray-500/g, 'text-gray-600');

  // text-blue-400/500 -> text-blue-600 (better contrast)
  content = content.replace(/(?<!dark:)text-blue-400/g, 'text-blue-600');
  content = content.replace(/(?<!dark:)text-blue-500/g, 'text-blue-600');
  
  // text-green-400/500 -> text-green-600
  content = content.replace(/(?<!dark:)text-green-400/g, 'text-green-600');
  content = content.replace(/(?<!dark:)text-green-500/g, 'text-green-600');
  
  // bg-slate-100 -> bg-slate-50 for slightly better contrast against white cards
  // wait, the user's "Biru Modern" has F1F5F9 which IS slate-100. Let's keep it.

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      fixContrast(fullPath);
    }
  }
}

walkDir('./src');
console.log('Contrast fixed!');
