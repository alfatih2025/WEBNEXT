const fs = require('fs');
const path = require('path');

function processClasses(classStr) {
  let classes = classStr.split(/\s+/).filter(Boolean);
  
  // Maps for balancing
  const bgMap = {
    'bg-white': 'dark:bg-[#0F172A]',
    'bg-slate-50': 'dark:bg-[#111827]',
    'bg-slate-100': 'dark:bg-[#111827]',
    'bg-gray-50': 'dark:bg-[#111827]',
    'bg-gray-100': 'dark:bg-[#111827]'
  };

  const borderMap = {
    'border-slate-100': 'dark:border-slate-800',
    'border-slate-200': 'dark:border-slate-800',
    'border-gray-100': 'dark:border-gray-800',
    'border-gray-200': 'dark:border-gray-800'
  };

  const textMap = {
    'text-slate-900': 'dark:text-slate-50',
    'text-slate-800': 'dark:text-slate-100',
    'text-slate-700': 'dark:text-slate-200',
    'text-slate-600': 'dark:text-slate-300',
    'text-slate-500': 'dark:text-slate-400',
    'text-gray-900': 'dark:text-gray-50',
    'text-gray-800': 'dark:text-gray-100',
    'text-gray-700': 'dark:text-gray-200',
    'text-gray-600': 'dark:text-gray-300',
    'text-gray-500': 'dark:text-gray-400',
    'text-blue-600': 'dark:text-blue-400',
    'text-green-600': 'dark:text-green-400'
  };

  let hasDarkBg = classes.some(c => c.startsWith('dark:bg-'));
  let hasDarkBorder = classes.some(c => c.startsWith('dark:border-'));
  let hasDarkText = classes.some(c => c.startsWith('dark:text-'));

  // Remove bad dark mode contrasts that might have been accidentally introduced
  classes = classes.map(c => {
    if (c === 'dark:text-gray-900' || c === 'dark:text-slate-900' || c === 'dark:text-gray-800' || c === 'dark:text-slate-800') return 'dark:text-slate-100';
    if (c === 'dark:text-gray-700' || c === 'dark:text-slate-700') return 'dark:text-slate-300';
    return c;
  });

  let newClasses = [...classes];

  classes.forEach(c => {
    if (bgMap[c] && !hasDarkBg) {
      newClasses.push(bgMap[c]);
      hasDarkBg = true;
    }
    if (borderMap[c] && !hasDarkBorder) {
      newClasses.push(borderMap[c]);
      hasDarkBorder = true;
    }
    if (textMap[c] && !hasDarkText) {
      newClasses.push(textMap[c]);
      hasDarkText = true;
    }
  });

  return newClasses.join(' ');
}

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Regex to find className="..."
  const regex = /className="([^"]+)"/g;
  content = content.replace(regex, (match, classStr) => {
    return `className="${processClasses(classStr)}"`;
  });

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
      replaceInFile(fullPath);
    }
  }
}

walkDir('./src');
console.log('Balanced themes successfully applied to all components!');
