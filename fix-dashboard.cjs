const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
code = code.replace(
  '          data={node2}\n        />\n        />',
  '          data={node2}\n        />'
);
code = code.replace(
  '          data={node2}\n        /> \n        />',
  '          data={node2}\n        />'
);
fs.writeFileSync('src/pages/Dashboard.tsx', code, 'utf8');
