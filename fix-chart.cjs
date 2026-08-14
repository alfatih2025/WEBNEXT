const fs = require('fs');

const path = 'src/components/SensorChart.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix CartesianGrid
content = content.replace(/stroke="#f0f0f0"/g, 'stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeOpacity={0.5}');
// Fix XAxis axisLine
content = content.replace(/axisLine={{ stroke: '#e5e5e5' }}/g, 'axisLine={{ stroke: "currentColor" }} className="text-slate-200 dark:text-slate-800"');

// Fix Tooltip background
content = content.replace(/backgroundColor: 'white'/g, "backgroundColor: 'var(--bg-secondary)'");
content = content.replace(/border: '1px solid #e5e5e5'/g, "border: '1px solid var(--border-color)'");
content = content.replace(/color: '#666'/g, "color: 'var(--text-secondary)'");

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed SensorChart colors');
