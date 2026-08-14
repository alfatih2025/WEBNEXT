const fs = require('fs');
let content = fs.readFileSync('src/context/ThemeContext.tsx', 'utf8');

content = content.replace(
  "localStorage.setItem('theme', theme);",
  `localStorage.setItem('theme', theme);
    
    // Update theme-color meta tag for mobile browsers
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = theme === 'dark' ? '#0F172A' : '#ffffff';`
);

fs.writeFileSync('src/context/ThemeContext.tsx', content, 'utf8');
console.log('Fixed ThemeContext meta theme-color');
