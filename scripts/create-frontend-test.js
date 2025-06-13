#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const frontendTestDir = path.join(__dirname, '..', '..', 'frontend-test')

// Template files
const templates = {
  'package.json': {
    "name": "vital-engine-frontend-test",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "vite build"
    },
    "dependencies": {
      "vital-engine-sdk": "file:../vital-engine-sdk"
    },
    "devDependencies": {
      "vite": "^4.0.0"
    }
  },

  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vital Engine Test</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: Arial, sans-serif;
        }
        
        #gameContainer {
            position: relative;
        }
        
        #gameCanvas {
            border: 2px solid #333;
            background: #1a1a1a;
        }
        
        #gameUI {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            color: white;
        }
        
        .ui-element {
            position: absolute;
            pointer-events: auto;
        }
        
        #healthBar {
            top: 10px;
            left: 10px;
            width: 200px;
            height: 20px;
            background: #333;
            border: 1px solid #666;
        }
        
        #healthFill {
            height: 100%;
            background: linear-gradient(90deg, #f00, #ff0);
            transition: width 0.3s ease;
        }
        
        #stats {
            top: 40px;
            left: 10px;
            font-size: 14px;
        }
        
        #controls {
            bottom: 10px;
            left: 10px;
            font-size: 12px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div id="gameContainer">
        <canvas id="gameCanvas" width="800" height="600"></canvas>
        <div id="gameUI">
            <div id="healthBar" class="ui-element">
                <div id="healthFill"></div>
            </div>
            <div id="stats" class="ui-element">
                <div>Level: <span id="level">1</span></div>
                <div>XP: <span id="xp">0</span></div>
                <div>Entities: <span id="entityCount">0</span></div>
                <div>FPS: <span id="fps">0</span></div>
            </div>
            <div id="controls" class="ui-element">
                WASD: Move | Mouse: Aim | Click: Attack | R: Restart
            </div>
        </div>
    </div>
    <script type="module" src="src/main.js"></script>
</body>
</html>`,

  'README.md': `# Vital Engine SDK - Frontend Test

This is a minimal frontend test project to validate the Vital Engine SDK integration.

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open browser to http://localhost:5173

## Controls

- **WASD**: Move player
- **Mouse**: Aim
- **Click**: Attack (auto-targeting)
- **R**: Restart game

## What This Tests

- ✅ SDK integration and imports
- ✅ Entity creation and management
- ✅ All core systems (Movement, Combat, Progression, Economy)
- ✅ Event system and frontend responses
- ✅ Real-time performance with rendering
- ✅ Input handling and player interaction

## Expected Behavior

- Green circle (player) in center
- Red circles (enemies) around edges
- Player moves with WASD
- Auto-attacks nearby enemies
- Health bars above entities
- UI updates for level, XP, entity count, FPS
- Console logs for game events

## Performance Expectations

- Should maintain 60 FPS with 10+ entities
- Smooth player movement
- Responsive combat and UI updates
`
}

// Create directory structure
function createDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`✓ Created directory: ${dirPath}`)
  }
}

// Write file with content
function writeFile(filePath, content) {
  const dir = path.dirname(filePath)
  createDir(dir)
  
  if (typeof content === 'object') {
    content = JSON.stringify(content, null, 2)
  }
  
  fs.writeFileSync(filePath, content)
  console.log(`✓ Created file: ${filePath}`)
}

// Copy file from documentation examples
function copyFromDocs(filename, targetPath) {
  const docsPath = path.join(__dirname, '..', 'docs', 'FRONTEND_INTEGRATION.md')
  
  if (!fs.existsSync(docsPath)) {
    console.warn(`⚠ Could not find documentation file: ${docsPath}`)
    return
  }
  
  // For now, create placeholder files - in a real implementation,
  // we would extract the code blocks from the markdown
  const placeholders = {
    'main.js': '// See docs/FRONTEND_INTEGRATION.md for complete implementation\nconsole.log("Frontend test - implement main.js from documentation")',
    'renderer.js': '// See docs/FRONTEND_INTEGRATION.md for complete implementation\nexport class Renderer { constructor(ctx) { this.ctx = ctx } }',
    'input.js': '// See docs/FRONTEND_INTEGRATION.md for complete implementation\nexport class InputHandler { constructor(canvas) { this.canvas = canvas } }',
    'ui.js': '// See docs/FRONTEND_INTEGRATION.md for complete implementation\nexport class UIManager { constructor() {} }'
  }
  
  if (placeholders[filename]) {
    writeFile(targetPath, placeholders[filename])
  }
}

// Main setup function
function createFrontendTest() {
  console.log('🚀 Creating Vital Engine SDK Frontend Test Project...\n')
  
  try {
    // Create main directory
    createDir(frontendTestDir)
    createDir(path.join(frontendTestDir, 'src'))
    
    // Create package.json
    writeFile(
      path.join(frontendTestDir, 'package.json'),
      templates['package.json']
    )
    
    // Create index.html
    writeFile(
      path.join(frontendTestDir, 'index.html'),
      templates['index.html']
    )
    
    // Create README
    writeFile(
      path.join(frontendTestDir, 'README.md'),
      templates['README.md']
    )
    
    // Create placeholder source files
    copyFromDocs('main.js', path.join(frontendTestDir, 'src', 'main.js'))
    copyFromDocs('renderer.js', path.join(frontendTestDir, 'src', 'renderer.js'))
    copyFromDocs('input.js', path.join(frontendTestDir, 'src', 'input.js'))
    copyFromDocs('ui.js', path.join(frontendTestDir, 'src', 'ui.js'))
    
    console.log('\n✅ Frontend test project created successfully!')
    console.log('\n📖 Next steps:')
    console.log('1. cd ../frontend-test')
    console.log('2. Copy the complete implementation from docs/FRONTEND_INTEGRATION.md')
    console.log('3. npm install')
    console.log('4. npm run dev')
    console.log('\n📋 The complete code examples are in: docs/FRONTEND_INTEGRATION.md')
    
  } catch (error) {
    console.error('❌ Error creating frontend test project:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  createFrontendTest()
}

module.exports = { createFrontendTest }