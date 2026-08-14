const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace `bg-white` with `bg-white dark:bg-gray-900 dark:border-gray-800` where appropriate
  // Only if there isn't already a dark:bg- class nearby.
  const regex = /className="([^"]*bg-white[^"]*)"/g;
  content = content.replace(regex, (match, classes) => {
    if (classes.includes('dark:bg-') || classes.includes('bg-white/')) {
      return match; // Already handled or translucent
    }
    // Add dark mode classes
    let newClasses = classes + ' dark:bg-gray-900 dark:border-gray-800';
    // If it has border-gray-100, border-gray-200 etc
    return `className="${newClasses}"`;
  });

  // Replace any text-gray-800 or text-gray-900 to adapt in dark mode
  const textRegex = /className="([^"]*text-gray-[89]00[^"]*)"/g;
  content = content.replace(textRegex, (match, classes) => {
    if (classes.includes('dark:text-')) return match;
    return `className="${classes} dark:text-gray-100"`;
  });
  
  // text-slate-900
  const slateRegex = /className="([^"]*text-slate-[89]00[^"]*)"/g;
  content = content.replace(slateRegex, (match, classes) => {
    if (classes.includes('dark:text-')) return match;
    return `className="${classes} dark:text-slate-100"`;
  });
  
  // Replace text-gray-700
  const text700Regex = /className="([^"]*text-(gray|slate)-700[^"]*)"/g;
  content = content.replace(text700Regex, (match, classes) => {
    if (classes.includes('dark:text-')) return match;
    return `className="${classes} dark:text-gray-300"`;
  });

  // border-gray-100 / 200
  const borderRegex = /className="([^"]*border-(gray|slate)-[12]00[^"]*)"/g;
  content = content.replace(borderRegex, (match, classes) => {
    if (classes.includes('dark:border-')) return match;
    return `className="${classes} dark:border-gray-800"`;
  });

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

walkDir('./src/pages');
walkDir('./src/components');
console.log('Dark mode classes added!');
