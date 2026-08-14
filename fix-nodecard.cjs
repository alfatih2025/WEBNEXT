const fs = require('fs');
let content = fs.readFileSync('src/components/NodeCard.tsx', 'utf8');

// Fix labels inheritance issue (Suhu, Kelembapan, Kelembapan Tanah)
content = content.replace(
  /<div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">\s*<Thermometer className="w-4 h-4 text-rose-500" \/>\s*<span className="text-sm font-medium">Suhu<\/span>/g,
  `<div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Suhu</span>`
);

content = content.replace(
  /<div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">\s*<Droplets className="w-4 h-4 text-blue-600 dark:text-blue-400" \/>\s*<span className="text-sm font-medium">Kelembapan<\/span>/g,
  `<div className="flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Kelembapan</span>`
);

content = content.replace(
  /<div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">\s*<Activity className="w-4 h-4 text-green-600 dark:text-green-400" \/>\s*<span className="text-sm font-medium">Kelembapan Tanah<\/span>/g,
  `<div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Kelembapan Tanah</span>`
);

// Ensure the units are perfect too
content = content.replace(/text-slate-600 dark:text-slate-300/g, 'text-slate-500 dark:text-slate-400');

fs.writeFileSync('src/components/NodeCard.tsx', content, 'utf8');
console.log('Fixed NodeCard labels');
