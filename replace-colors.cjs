const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace emerald with green
  content = content.replace(/emerald/g, 'green');
  
  // Replace cyan with blue
  content = content.replace(/cyan/g, 'blue');
  
  // Replace sky with blue
  content = content.replace(/sky/g, 'blue');

  // Replace text-slate-800 with text-slate-900 (better contrast)
  content = content.replace(/text-slate-800/g, 'text-slate-900');
  
  // Replace bg-slate-50 with bg-slate-50 or bg-blue-50/30 ?
  // Actually, Biru Modern has F1F5F9 which is slate-100.
  content = content.replace(/bg-slate-50/g, 'bg-slate-100');
  content = content.replace(/bg-gray-50/g, 'bg-slate-100');

  fs.writeFileSync(filePath, content, 'utf8');
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir('./src');
console.log('Colors replaced successfully!');
