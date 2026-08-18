const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const target = `      {/* Node Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NodeCard 
          nodeName="Wemos Node 1" 
          data={node1}
        />
        <NodeCard 
          nodeName="Wemos Node 2" 
          data={node2}
        />
      </div>`;

// Regex replace everything between {/* Node Cards */} and {/* Comparison Panel */}
code = code.replace(/\{\/\* Node Cards \*\/\}.*?\{\/\* Comparison Panel \*\/\}/s, target + '\n      {/* Comparison Panel */}');
fs.writeFileSync('src/pages/Dashboard.tsx', code, 'utf8');
