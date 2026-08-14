const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

content = content.replace(
  /<div className="glass-card overflow-hidden border-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative">([\s\S]*?)<div className="absolute inset-0 bg-\[url\('https:\/\/www.transparenttextures.com\/patterns\/cubes.png'\)\] opacity-10"><\/div>([\s\S]*?)<h1 className="text-3xl text-white md:text-4xl font-black tracking-tight mb-2 flex items-center gap-3">([\s\S]*?)<p className="text-slate-300 text-sm md:text-base max-w-xl">([\s\S]*?)<div className="flex flex-col items-end gap-2 bg-slate-950\/50 p-4 rounded-2xl border border-white\/10 backdrop-blur-md">([\s\S]*?)<div className={`w-2 h-2 rounded-full \${mqttConnected \? 'bg-blue-400' : 'bg-red-500'}`}><\/div>\s*<span className="font-semibold">\{mqttConnected \? 'Broker OK' : 'Broker Disconnected'}<\/span>([\s\S]*?)<div className="w-px h-4 bg-slate-700"><\/div>([\s\S]*?)<div className={`w-2 h-2 rounded-full \${nodesOnline > 0 \? 'bg-green-400' : 'bg-red-500'}`}><\/div>\s*<span className="font-semibold text-green-600 dark:text-green-400">\{nodesOnline}\/2 Nodes Online<\/span>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g,
  `<div className="glass-card overflow-hidden border-0 bg-gradient-to-br from-green-50 to-emerald-100/50 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-white relative">$1<div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 dark:opacity-10"></div>$2<h1 className="text-3xl text-slate-900 dark:text-white md:text-4xl font-black tracking-tight mb-2 flex items-center gap-3">$3<p className="text-slate-600 dark:text-slate-300 text-sm md:text-base max-w-xl">$4<div className="flex flex-col items-end gap-2 bg-white/60 dark:bg-slate-950/50 p-4 rounded-2xl border border-white/40 dark:border-white/10 backdrop-blur-md shadow-sm dark:shadow-none">$5<div className={\`w-2 h-2 rounded-full \${mqttConnected ? 'bg-blue-500 dark:bg-blue-400' : 'bg-red-500'}\`}></div>
                <span className="font-semibold text-slate-700 dark:text-slate-100">{mqttConnected ? 'Broker OK' : 'Broker Disconnected'}</span>$6<div className="w-px h-4 bg-slate-300 dark:bg-slate-700"></div>$7<div className={\`w-2 h-2 rounded-full \${nodesOnline > 0 ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500'}\`}></div>
                <span className="font-semibold text-green-700 dark:text-green-400">{nodesOnline}/2 Nodes Online</span>$8</div>
        </div>
      </div>
      </div>`
);

fs.writeFileSync('src/pages/Dashboard.tsx', content, 'utf8');
console.log('Fixed hero section');
