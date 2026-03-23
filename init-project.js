#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Parse command line arguments
const rawArgs = process.argv.slice(2);
const args = {
    _: [],
    'non-interactive': rawArgs.includes('--non-interactive'),
    help: rawArgs.includes('--help') || rawArgs.includes('-h'),
    'skip-install': rawArgs.includes('--skip-install'),
    'no-include-examples': rawArgs.includes('--no-include-examples'),
    local: rawArgs.includes('--local'),
};

// Parse key-value pairs
for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith('--') && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
        const key = arg.slice(2);
        args[key] = rawArgs[i + 1];
        i++; // Skip the value
    } else if (
        arg.startsWith('-') &&
        arg.length === 2 &&
        i + 1 < rawArgs.length &&
        !rawArgs[i + 1].startsWith('-')
    ) {
        const key = arg.slice(1);
        args[key] = rawArgs[i + 1];
        i++; // Skip the value
    }
}

// Map short flags to long names
if (args.n) args.name = args.n;
if (args.i) args.id = args.i;
if (args.s) args.server = args.s;

// Extract an indented block for a top-level YAML section, stopping at the next
// top-level key (a line starting with a non-space, non-# character followed by `:`).
function yamlSection(yaml, sectionName) {
    const sectionRe = new RegExp(`^${sectionName}:\\s*$`, 'm');
    const sectionStart = yaml.search(sectionRe);
    if (sectionStart === -1) return '';
    const afterHeader = yaml.indexOf('\n', sectionStart);
    if (afterHeader === -1) return '';
    const rest = yaml.slice(afterHeader + 1);
    const nextSection = rest.search(/^\S.*:/m);
    return nextSection === -1 ? rest : rest.slice(0, nextSection);
}

function yamlSectionUrl(yaml, sectionName) {
    const block = yamlSection(yaml, sectionName);
    const match = block.match(/url:\s*["']?(https?:\/\/[^\s"']+)/);
    return match ? match[1] : '';
}

function yamlSectionValue(yaml, sectionName, key) {
    const block = yamlSection(yaml, sectionName);
    const match = block.match(new RegExp(`${key}:\\s*["']?([^\\s"'#]+)`));
    return match ? match[1] : '';
}

// Create readline interface
let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Helper function to ask questions with default values
function ask(question, defaultValue = '') {
    return new Promise((resolve) => {
        const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
        rl.question(prompt, (answer) => {
            resolve(answer || defaultValue);
        });
    });
}

// Helper function to ask yes/no questions
function askYesNo(question, defaultYes = true) {
    return new Promise((resolve) => {
        const defaultText = defaultYes ? '[Y/n]' : '[y/N]';
        rl.question(`${question} ${defaultText}: `, (answer) => {
            const response = answer.toLowerCase() || (defaultYes ? 'y' : 'n');
            resolve(response === 'y' || response === 'yes');
        });
    });
}

// Helper function to replace template placeholders
function replaceTemplatePlaceholders(content, replacements) {
    let result = content;
    for (const [placeholder, value] of Object.entries(replacements)) {
        const regex = new RegExp(`{{${placeholder}}}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}

// Helper function to get Git info
function getGitInfo() {
    try {
        // Get remote origin URL
        const remoteUrl = execSync('git config --get remote.origin.url', {
            encoding: 'utf-8',
        }).trim();

        // Extract owner and repo name from URL
        const match = remoteUrl.match(/github\.com[/:]([\w-]+)\/([\w.-]+?)(\.git)?$/);
        if (match) {
            return {
                owner: match[1],
                repo: match[2],
                isFromTemplate: true,
            };
        }
    } catch (error) {
        // Not a git repo or no remote
    }
    return null;
}

// Helper function to check if this is a fresh template
function isFreshTemplate() {
    try {
        // Check if we have exactly 1 commit (the initial template commit)
        const commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim();
        return commitCount === '1';
    } catch (e) {
        return false;
    }
}

// Read the template version stamp (.aether-template) if present.
// Returns a short string like "aether-dev@abc1234 (2026-03-18)" or null.
function getTemplateVersion() {
    try {
        const stampPath = path.join(process.cwd(), '.aether-template');
        const content = fs.readFileSync(stampPath, 'utf-8');
        const source = content.match(/source:\s*(.+)/)?.[1]?.trim();
        const built = content.match(/built:\s*(.+)/)?.[1]?.trim();
        if (source) {
            const date = built ? ` (${built.split('T')[0]})` : '';
            return `${source}${date}`;
        }
    } catch {
        // No stamp file — running in aether-dev itself or pre-stamp template
    }
    return null;
}

// Helper function to generate unique app ID from name
function generateAppId(projectName) {
    // Convert to lowercase, replace spaces and special chars with hyphens
    let appId = projectName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    // Add a timestamp suffix to ensure uniqueness
    const timestamp = Date.now().toString(36).substring(0, 4);
    return `${appId}-${timestamp}`;
}

// Main init function
async function init() {
    const templateVersion = getTemplateVersion();
    console.log('\n🌎 Aether 2.0 Project Initializer');
    if (templateVersion) console.log(`   Template: ${templateVersion}`);
    console.log('===========================\n');

    // Auto-detect GitHub info
    const gitInfo = getGitInfo();
    const isFresh = isFreshTemplate();

    if (gitInfo && isFresh) {
        console.log('🎯 Detected fresh GitHub repository created from template!');
        console.log(`   Repository: ${gitInfo.owner}/${gitInfo.repo}\n`);
    }

    console.log('Welcome! This wizard will help you set up your new Aether application.\n');
    console.log("Aether is a modular UI framework - you'll build your app by creating features!\n");

    // Step 1: Project Info
    console.log('📝 Step 1: Project Information\n');

    // Use repo name as default if available
    const defaultProjectName = gitInfo?.repo || 'my-awesome-app';
    const projectName = await ask('Project name', defaultProjectName);
    const cleanProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Generate a unique app ID
    const suggestedAppId = generateAppId(projectName);
    console.log('\n🔑 App ID is used for preferences isolation between Aether apps.');
    console.log('   It must be unique across all your Aether applications.');
    const appId = await ask('App ID (must be unique)', suggestedAppId);
    const cleanAppId = appId.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const title = cleanProjectName
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    const appTitle = await ask('App display name', title);
    const description = await ask('Project description', 'A modular application built with Aether');

    // Step 2: Server Configuration
    console.log('\n🌐 Step 2: Query Server Configuration\n');
    console.log(
        'The Query Server provides the API for your application (entities, reports, sentiment, etc.).\n'
    );

    const productionQueryServer = 'https://query.news.prod.g.lovelace.ai';
    const localServer = 'http://localhost:50053';

    // Ask about query server
    console.log('🔌 Query Server - API for entities, reports, sentiment, etc.');
    const needsQueryServer = await askYesNo('Will your app connect to the query server?', true);
    let queryServerAddress = '';

    if (needsQueryServer) {
        const serverChoice = await ask('Query server - (1) Production, (2) Local', '1');
        if (serverChoice === '1') {
            queryServerAddress = productionQueryServer;
        } else if (serverChoice === '2') {
            queryServerAddress = localServer;
        } else {
            queryServerAddress = await ask('Custom query server address', productionQueryServer);
        }
    }

    // Step 3: Features Selection
    console.log('\n✨ Step 3: Initial Features\n');
    console.log('Aether includes example features to help you get started.');
    console.log('You can remove them later or use them as templates.\n');

    const includeExamples = await askYesNo('Include example features?', true);

    // Step 4: Authentication
    console.log('\n🔐 Step 4: Authentication Setup\n');
    const needsAuth = await askYesNo('Will your app require user authentication?', false);

    let auth0Config = {
        domain: '',
        clientId: '',
        clientSecret: '',
        audience: '',
    };

    if (needsAuth) {
        console.log('\nAether uses Auth0 for authentication.');
        console.log("You'll need to set up an Auth0 application.\n");

        const hasAuth0 = await askYesNo('Do you have Auth0 credentials ready?', false);
        if (hasAuth0) {
            auth0Config.clientId = await ask('Auth0 client ID');
            auth0Config.clientSecret = await ask('Auth0 client secret');
            auth0Config.audience = await ask('Auth0 API audience (optional)', '');
        } else {
            console.log('\n💡 No problem! You can add Auth0 credentials later to your .env file.');
        }
    }

    // Step 5: Update files
    console.log('\n🔧 Step 5: Configuring your project...\n');

    // Update package.json
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

    packageJson.name = cleanProjectName;
    packageJson.productName = appTitle;
    packageJson.description = description;

    // Add init script if not present
    if (!packageJson.scripts.init) {
        packageJson.scripts.init = 'node init-project.js';
    }

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Updated package.json');

    // Update nuxt.config.ts
    const nuxtConfigPath = path.join(process.cwd(), 'nuxt.config.ts');
    let nuxtConfig = fs.readFileSync(nuxtConfigPath, 'utf-8');

    // Update the title if it exists in head configuration
    if (nuxtConfig.includes('title:')) {
        nuxtConfig = nuxtConfig.replace(/title:\s*["'].*?["']/, `title: "${appTitle}"`);
    }

    fs.writeFileSync(nuxtConfigPath, nuxtConfig);
    console.log('✅ Updated nuxt.config.ts');

    // Create/Update README.md
    const readmePath = path.join(process.cwd(), 'README.md');
    const readmeContent = `# ${appTitle}

${description}

## 🚀 Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
\`\`\`

## 🏗️ Project Structure

This is an Aether application built on Nuxt 3 + Vuetify. Pages are in \`pages/\`, components in \`components/\`, and composables in \`composables/\`.

### Current Features

${
    includeExamples
        ? `- **Entity Lookup** (\`pages/entity-lookup.vue\`) - Search the Query Server for named entities
- **Agent Chat** (\`pages/chat.vue\`) - Talk to deployed AI agents
- **MCP Explorer** (\`pages/mcp.vue\`) - Browse and test MCP server tools`
        : '- No pages yet - run \`/build_my_app\` in Cursor to get started!'
}

### Adding Pages

Create new pages in \`pages/\` and Nuxt will generate routes automatically.

## 🔧 Configuration

### Environment Variables

Create a \`.env\` file with:

\`\`\`bash
# App Configuration
NUXT_PUBLIC_APP_ID=${cleanAppId}
NUXT_PUBLIC_APP_NAME="${appTitle}"

# Query Server Configuration
# Leave empty if not using the query server
NUXT_PUBLIC_QUERY_SERVER_ADDRESS=${queryServerAddress}

${
    needsAuth
        ? `# When using Auth0, NUXT_PUBLIC_USER_NAME must be empty
NUXT_PUBLIC_USER_NAME=

# Auth0 Configuration
NUXT_PUBLIC_AUTH0_CLIENT_ID=${auth0Config.clientId || 'your-client-id'}
NUXT_PUBLIC_AUTH0_CLIENT_SECRET=${auth0Config.clientSecret || 'your-client-secret'}
NUXT_PUBLIC_AUTH0_AUDIENCE=${auth0Config.audience || 'your-api-audience'}
`
        : `# Local username (when not using Auth0)
NUXT_PUBLIC_USER_NAME=${process.env.USER || 'local-user'}
`
}
\`\`\`

## 📚 Documentation

- [Documentation](README.md)

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Update DESIGN.md with any architectural decisions
4. Submit a pull request

## 📄 License

[Your License Here]
`;

    fs.writeFileSync(readmePath, readmeContent);
    console.log('✅ Created README.md');

    // Create DESIGN.md from template (skip if already populated by Portal)
    const designPath = path.join(process.cwd(), 'DESIGN.md');
    const existingDesign = fs.existsSync(designPath) ? fs.readFileSync(designPath, 'utf-8') : '';
    const hasRealContent =
        existingDesign.includes('## Vision') ||
        (existingDesign.length > 100 && !existingDesign.includes('{{'));

    if (hasRealContent) {
        console.log('✅ DESIGN.md already has content (from project brief) — keeping it.');
    } else {
        const currentDate = new Date().toISOString().split('T')[0];
        const designTemplate = fs.readFileSync(
            path.join(__dirname, 'design', 'design_template.md'),
            'utf-8'
        );
        const designContent = replaceTemplatePlaceholders(designTemplate, {
            APP_TITLE: appTitle,
            DATE: currentDate,
            APP_ID: cleanAppId,
            DESCRIPTION: description,
            AUTH: needsAuth ? 'Auth0' : 'None (public app)',
            QUERY_SERVER: needsQueryServer ? queryServerAddress : 'Not configured',
        });

        fs.writeFileSync(designPath, designContent);
        console.log("✅ Created DESIGN.md - Your project's blueprint!");
        console.log('   📝 Update DESIGN.md with your project vision and architecture.');
        console.log('   🤖 AI agents read this first to understand what you want to build.');
    }

    // Step 7: Design your project
    console.log('\n🎨 Step 7: Design Your Project\n');
    console.log('Update DESIGN.md to describe:');
    console.log("   • What you're building and why");
    console.log('   • Who will use your application');
    console.log('   • The key features you need\n');
    console.log('As you start building, create feature docs in design/ to plan work');
    console.log('with your AI agent. Copy design/feature_template.md to get started.\n');

    const shouldOpenDesign = await askYesNo(
        'Would you like to open DESIGN.md in your editor now?',
        true
    );
    if (shouldOpenDesign) {
        let opened = false;
        let cursorAvailable = false;

        // First, check if cursor command is available
        try {
            const checkCommand = process.platform === 'win32' ? 'where cursor' : 'which cursor';
            execSync(checkCommand, { stdio: 'ignore' });
            cursorAvailable = true;
        } catch (e) {
            // cursor command not found
        }

        if (cursorAvailable) {
            // Try to open with Cursor
            try {
                execSync(`cursor "${designPath}"`, { stdio: 'ignore' });
                console.log('✅ Opening DESIGN.md in Cursor...');
                console.log('   Please update it before proceeding!\n');
                opened = true;
            } catch (e) {
                // cursor command failed
            }
        } else {
            // Cursor CLI not installed, provide helpful instructions
            console.log('\n💡 Cursor CLI not found. To enable direct Cursor integration:');
            console.log('   1. Open Cursor');
            console.log('   2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)');
            console.log('   3. Type "Install \'cursor\' command in PATH" and select it');
            console.log('   4. Re-run this init script for direct Cursor integration\n');
        }

        // If Cursor didn't work, try the system default
        if (!opened) {
            try {
                const opener =
                    process.platform === 'darwin'
                        ? 'open'
                        : process.platform === 'win32'
                          ? 'start'
                          : 'xdg-open';
                execSync(`${opener} ${designPath}`, { stdio: 'ignore' });
                console.log('✅ Opening DESIGN.md in your default editor...');
                if (!cursorAvailable) {
                    console.log('   (Follow the steps above to enable Cursor integration)');
                }
                console.log('   Please update it before proceeding!\n');
                opened = true;
            } catch (e) {
                // Both methods failed
            }
        }

        if (opened) {
            // Give them a moment to realize the file is opening
            await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
            console.log('⚠️  Could not open DESIGN.md automatically.');
            console.log(`   Please open ${designPath} manually in Cursor.`);
        }
    }

    // Create .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = `# Aether Application Configuration
# Generated by init script on ${new Date().toLocaleString()}

# App Identity (REQUIRED - Must be unique per app!)
NUXT_PUBLIC_APP_ID=${cleanAppId}
NUXT_PUBLIC_APP_NAME="${appTitle}"

# Query Server Configuration
# Leave empty if not using the query server
NUXT_PUBLIC_QUERY_SERVER_ADDRESS=${queryServerAddress}
`;

    if (needsAuth) {
        envContent += `
# When using Auth0, NUXT_PUBLIC_USER_NAME must be empty
NUXT_PUBLIC_USER_NAME=

# Auth0 Configuration
${auth0Config.clientId ? `NUXT_PUBLIC_AUTH0_CLIENT_ID=${auth0Config.clientId}` : '# NUXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id'}
${auth0Config.clientSecret ? `NUXT_PUBLIC_AUTH0_CLIENT_SECRET=${auth0Config.clientSecret}` : '# NUXT_PUBLIC_AUTH0_CLIENT_SECRET=your-client-secret'}
${auth0Config.audience ? `NUXT_PUBLIC_AUTH0_AUDIENCE=${auth0Config.audience}` : '# NUXT_PUBLIC_AUTH0_AUDIENCE=your-api-audience'}
`;
    } else {
        envContent += `
# Local username (when not using Auth0)
NUXT_PUBLIC_USER_NAME=${process.env.USER || 'local-user'}
`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env file');

    // Create .env.example
    const envExamplePath = path.join(process.cwd(), '.env.example');
    fs.writeFileSync(envExamplePath, envContent.replace(/=.*/g, '='));
    console.log('✅ Created .env.example');

    // Generate .cursor/mcp.json for Lovelace MCP servers
    const bcPath = path.join(process.cwd(), 'broadchurch.yaml');
    if (fs.existsSync(bcPath)) {
        const yaml = fs.readFileSync(bcPath, 'utf-8');
        const gwUrl = yamlSectionUrl(yaml, 'gateway');
        const orgId = yamlSectionValue(yaml, 'tenant', 'org_id');
        await generateMcpJson(gwUrl, orgId);
    } else {
        await generateMcpJson();
    }

    // Update .gitignore if needed
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        let gitignore = fs.readFileSync(gitignorePath, 'utf-8');
        if (!gitignore.includes('.env')) {
            gitignore += '\n# Environment files\n.env\n.env.local\n';
            fs.writeFileSync(gitignorePath, gitignore);
            console.log('✅ Updated .gitignore');
        }
    }

    // Remove example pages if not wanted
    if (!includeExamples) {
        console.log('\n🧹 Removing example pages...');
        for (const page of ['entity-lookup.vue', 'chat.vue', 'mcp.vue']) {
            const pagePath = path.join(process.cwd(), 'pages', page);
            if (fs.existsSync(pagePath)) {
                fs.rmSync(pagePath);
                console.log(`   Removed pages/${page}`);
            }
        }
    }

    // Step 8: Install dependencies
    console.log('\n📦 Step 8: Install Dependencies\n');

    const shouldInstall = await askYesNo(
        'Would you like to install dependencies now? (This may take a minute)',
        true
    );

    if (shouldInstall) {
        console.log('\n📦 Installing dependencies...\n');
        try {
            execSync('npm install', { stdio: 'inherit' });
            console.log('\n✅ Dependencies installed successfully!');
        } catch (error) {
            console.error('\n❌ Error installing dependencies:', error.message);
            console.log('You can install them manually by running: npm install');
        }
    }

    // Step 9: Extract Aether instructions
    console.log('\n📋 Step 9: Aether Instructions\n');
    extractAetherInstructions();

    // Final message
    console.log('\n' + '='.repeat(70));
    console.log('\n🎉 PROJECT SETUP COMPLETE! 🎉\n');
    console.log('='.repeat(70));

    console.log('\n🚀 READY TO BUILD!\n');

    console.log('⚡ QUICK START:\n');
    console.log('1. Start the development server:');
    console.log('   → npm run dev\n');
    console.log('2. Open your browser to:');
    console.log('   → http://localhost:3000\n');

    if (includeExamples) {
        console.log('3. Explore the built-in pages:');
        console.log('   → Try Entity Lookup for Query Server API integration');
        console.log('   → Open Agent Chat to talk to your deployed agents\n');
    }

    console.log('📝 NEXT STEPS:\n');
    console.log('1. Update DESIGN.md with your project vision and architecture');
    console.log('2. Create a feature doc in design/ to plan your first feature');
    console.log('   (copy design/feature_template.md to get started)');
    console.log('3. Open your AI assistant and start building!\n');

    console.log('📚 DOCUMENTATION:\n');
    console.log('• Quick Start: README.md');
    console.log('• Documentation: README.md\n');

    console.log('💡 YOUR APP ID: ' + cleanAppId);
    console.log('   This uniquely identifies your app for preferences storage.\n');

    console.log('='.repeat(70));
    console.log('\nHappy building with Aether! ✨\n');

    rl.close();
}

// Non-interactive mode implementation
async function runNonInteractiveInit(config) {
    const {
        projectName,
        appId,
        appTitle,
        description = 'A modular application built with Aether',
        queryServer = '',
        includeExamples = true,
        skipInstall = false,
        auth0ClientId = '',
        auth0ClientSecret = '',
        auth0Audience = '',
    } = config;

    const cleanProjectName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const cleanAppId = appId || generateAppId(projectName);
    const title =
        appTitle ||
        cleanProjectName
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

    // Update package.json
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

    packageJson.name = cleanProjectName;
    packageJson.productName = title;
    packageJson.description = description;

    if (!packageJson.scripts.init) {
        packageJson.scripts.init = 'node init-project.js';
    }

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Updated package.json');

    // Update nuxt.config.ts
    const nuxtConfigPath = path.join(process.cwd(), 'nuxt.config.ts');
    let nuxtConfig = fs.readFileSync(nuxtConfigPath, 'utf-8');

    if (nuxtConfig.includes('title:')) {
        nuxtConfig = nuxtConfig.replace(/title:\s*["'].*?["']/, `title: "${title}"`);
    }

    fs.writeFileSync(nuxtConfigPath, nuxtConfig);
    console.log('✅ Updated nuxt.config.ts');

    // Create README.md (simplified for non-interactive)
    const readmePath = path.join(process.cwd(), 'README.md');
    const readmeContent = `# ${title}

${description}

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Configuration

See \`.env\` for configuration options.

## Documentation

- [Quick Start Guide](README.md)
`;

    fs.writeFileSync(readmePath, readmeContent);
    console.log('✅ Created README.md');

    // Create DESIGN.md from template (skip if already populated by Portal)
    const designPath = path.join(process.cwd(), 'DESIGN.md');
    const existingDesign = fs.existsSync(designPath) ? fs.readFileSync(designPath, 'utf-8') : '';
    const hasRealContent =
        existingDesign.includes('## Vision') ||
        (existingDesign.length > 100 && !existingDesign.includes('{{'));

    if (hasRealContent) {
        console.log('✅ DESIGN.md already has content — keeping it.');
    } else {
        const currentDate = new Date().toISOString().split('T')[0];
        const designTemplate = fs.readFileSync(
            path.join(__dirname, 'design', 'design_template.md'),
            'utf-8'
        );
        const designContent = replaceTemplatePlaceholders(designTemplate, {
            APP_TITLE: title,
            DATE: currentDate,
            APP_ID: cleanAppId,
            DESCRIPTION: description,
            AUTH: auth0ClientId ? 'Auth0' : 'Not yet configured',
            QUERY_SERVER: queryServer || 'Not yet configured',
        });

        fs.writeFileSync(designPath, designContent);
        console.log('✅ Created DESIGN.md');
    }

    // Create .env file
    const envPath = path.join(process.cwd(), '.env');
    const envContent = `# Aether Application Configuration
# Generated by init script on ${new Date().toLocaleString()}

# App Identity (REQUIRED - Must be unique per app!)
NUXT_PUBLIC_APP_ID=${cleanAppId}
NUXT_PUBLIC_APP_NAME="${title}"

# Query Server Configuration
# Leave empty if not using the query server
NUXT_PUBLIC_QUERY_SERVER_ADDRESS=${queryServer}

# User configuration
${auth0ClientId ? '# When using Auth0, NUXT_PUBLIC_USER_NAME must be empty\nNUXT_PUBLIC_USER_NAME=' : `# Local username (when not using Auth0)\nNUXT_PUBLIC_USER_NAME=${process.env.USER || 'local-user'}`}

# Auth0 Configuration
${auth0ClientId ? `NUXT_PUBLIC_AUTH0_CLIENT_ID=${auth0ClientId}` : '# NUXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id'}
${auth0ClientSecret ? `NUXT_PUBLIC_AUTH0_CLIENT_SECRET=${auth0ClientSecret}` : '# NUXT_PUBLIC_AUTH0_CLIENT_SECRET=your-client-secret'}
${auth0Audience ? `NUXT_PUBLIC_AUTH0_AUDIENCE=${auth0Audience}` : '# NUXT_PUBLIC_AUTH0_AUDIENCE=your-api-audience'}
`;

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env file');

    // Create .env.example
    const envExamplePath = path.join(process.cwd(), '.env.example');
    fs.writeFileSync(envExamplePath, envContent.replace(/=.*/g, '='));
    console.log('✅ Created .env.example');

    // Generate .cursor/mcp.json — use gateway proxy URLs if broadchurch.yaml is available
    const bcPath = path.join(process.cwd(), 'broadchurch.yaml');
    if (fs.existsSync(bcPath)) {
        const yaml = fs.readFileSync(bcPath, 'utf-8');
        const gwUrl = yamlSectionUrl(yaml, 'gateway');
        const orgId = yamlSectionValue(yaml, 'tenant', 'org_id');
        await generateMcpJson(gwUrl, orgId);
    } else {
        await generateMcpJson();
    }

    // Extract Aether instructions (rules, commands, skills)
    extractAetherInstructions();

    // Remove example pages if requested
    if (!includeExamples) {
        for (const page of ['entity-lookup.vue', 'chat.vue', 'mcp.vue']) {
            const pagePath = path.join(process.cwd(), 'pages', page);
            if (fs.existsSync(pagePath)) {
                fs.rmSync(pagePath);
            }
        }
        console.log('✅ Removed example pages');
    }

    if (!skipInstall) {
        console.log('\n📦 Installing dependencies...\n');
        try {
            execSync('npm install', { stdio: 'inherit' });
            console.log('\n✅ Dependencies installed successfully!');
        } catch (error) {
            console.error('\n❌ Error installing dependencies:', error.message);
            console.log('You can install them manually by running: npm install');
        }
    }
}

// Extract Aether instructions from the @yottagraph-app/aether-instructions npm package.
// Downloads the package, removes previously installed files (tracked via manifest),
// and extracts fresh ones with their original filenames.
function extractAetherInstructions() {
    const os = require('os');
    const cursorDir = path.join(process.cwd(), '.cursor');
    const manifestPath = path.join(cursorDir, '.aether-instructions-manifest');
    const tempDir = path.join(os.tmpdir(), 'aether-instructions-extract-' + Date.now());

    console.log('📦 Downloading Aether instructions...');

    try {
        fs.mkdirSync(tempDir, { recursive: true });

        // Download package
        execSync(
            `npm pack @yottagraph-app/aether-instructions@latest --pack-destination "${tempDir}"`,
            {
                stdio: 'pipe',
            }
        );

        // Find and extract tarball
        const tarball = fs.readdirSync(tempDir).find((f) => f.endsWith('.tgz'));
        if (!tarball) {
            console.log('⚠️  Could not download Aether instructions package.');
            return;
        }

        execSync(`tar -xzf "${path.join(tempDir, tarball)}" -C "${tempDir}"`, { stdio: 'pipe' });
        const pkgDir = path.join(tempDir, 'package');

        // Read package version
        const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'));
        const version = pkgJson.version;

        // Delete files from previous install using manifest (also cleans up
        // legacy aether_* prefixed files from older package versions)
        if (fs.existsSync(manifestPath)) {
            const oldFiles = fs
                .readFileSync(manifestPath, 'utf-8')
                .trim()
                .split('\n')
                .filter(Boolean);
            for (const rel of oldFiles) {
                const target = path.join(cursorDir, rel);
                if (fs.existsSync(target)) {
                    fs.rmSync(target, { recursive: true, force: true });
                }
            }
        }
        // Also clean up legacy aether_* files from pre-manifest versions
        for (const subdir of ['rules', 'commands']) {
            const destDir = path.join(cursorDir, subdir);
            if (fs.existsSync(destDir)) {
                for (const file of fs.readdirSync(destDir)) {
                    if (file.startsWith('aether_')) {
                        fs.unlinkSync(path.join(destDir, file));
                    }
                }
            }
        }
        const skillsDir = path.join(cursorDir, 'skills');
        if (fs.existsSync(skillsDir)) {
            for (const dir of fs.readdirSync(skillsDir)) {
                if (dir.startsWith('aether_')) {
                    fs.rmSync(path.join(skillsDir, dir), { recursive: true, force: true });
                }
            }
        }

        // Copy new files from package and build manifest
        const manifest = [];
        let rulesCount = 0;
        let commandsCount = 0;
        let skillsCount = 0;

        for (const subdir of ['rules', 'commands', 'skills']) {
            const src = path.join(pkgDir, subdir);
            const dest = path.join(cursorDir, subdir);
            if (!fs.existsSync(src)) continue;

            fs.mkdirSync(dest, { recursive: true });

            for (const item of fs.readdirSync(src)) {
                if (item === '.gitkeep') continue;

                const srcPath = path.join(src, item);
                const destPath = path.join(dest, item);

                if (fs.statSync(srcPath).isDirectory()) {
                    fs.cpSync(srcPath, destPath, { recursive: true });
                    if (subdir === 'skills') skillsCount++;
                } else {
                    fs.copyFileSync(srcPath, destPath);
                    if (subdir === 'rules') rulesCount++;
                    if (subdir === 'commands') commandsCount++;
                }
                manifest.push(`${subdir}/${item}`);
            }
        }

        // Write manifest (tracks which files came from the package)
        fs.writeFileSync(manifestPath, manifest.join('\n') + '\n');

        // Write version marker
        fs.writeFileSync(path.join(cursorDir, '.aether-instructions-version'), version);

        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });

        console.log(`✅ Installed @yottagraph-app/aether-instructions@${version}`);
        console.log(
            `   ${rulesCount} rules, ${commandsCount} commands, ${skillsCount} skill directories`
        );
    } catch (error) {
        console.log('⚠️  Could not install Aether instructions: ' + error.message);
        console.log('   You can install them later by running /update_instructions');
        // Clean up temp dir on error
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

// Generate .cursor/mcp.json so Cursor agents can use the Lovelace MCP servers.
// When gatewayUrl and tenantId are available (from broadchurch.yaml), routes
// traffic through the Portal Gateway proxy — no MCP credentials needed locally.
// Falls back to direct URLs with a dev token placeholder if gateway info is missing.
// Also discovers tenant-deployed MCP servers from the config API when available.
async function generateMcpJson(gatewayUrl, tenantId) {
    const mcpJsonPath = path.join(process.cwd(), '.cursor', 'mcp.json');
    const useGateway = gatewayUrl && tenantId;

    // Gateway credentials are authoritative — always overwrite (the template
    // ships with dev-token URLs that won't work in tenant projects).
    // Without gateway info, preserve any existing config.
    if (fs.existsSync(mcpJsonPath) && !useGateway) {
        console.log('ℹ️  .cursor/mcp.json already exists — skipping creation.');
        return;
    }

    const platformServers = ['elemental', 'stocks', 'wiki', 'polymarket'];

    const mcpServers = {};
    for (const name of platformServers) {
        if (useGateway) {
            mcpServers[`lovelace-${name}`] = {
                url: `${gatewayUrl}/api/mcp/${tenantId}/${name}/mcp`,
            };
        } else {
            mcpServers[`lovelace-${name}`] = {
                url: `https://mcp.news.prod.g.lovelace.ai/${name}/mcp`,
                headers: { Authorization: 'Bearer ${AUTH0_M2M_DEV_TOKEN}' },
            };
        }
    }

    // Discover tenant-deployed MCP servers from the config API
    if (useGateway) {
        const platformSet = new Set(platformServers);
        try {
            const res = await fetch(`${gatewayUrl}/api/config/${tenantId}`);
            if (res.ok) {
                const config = await res.json();
                for (const server of config.mcp_servers || []) {
                    if (server.name && !platformSet.has(server.name)) {
                        mcpServers[server.name] = {
                            url: `${gatewayUrl}/api/mcp/${tenantId}/${server.name}/mcp`,
                        };
                    }
                }
            }
        } catch {
            // Config API unreachable — continue with platform servers only
        }
    }

    fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
    fs.writeFileSync(mcpJsonPath, JSON.stringify({ mcpServers }, null, 2) + '\n');

    if (useGateway) {
        const extra = Object.keys(mcpServers).length - platformServers.length;
        const suffix = extra > 0 ? ` + ${extra} tenant-deployed` : '';
        console.log(
            `✅ Created .cursor/mcp.json (${platformServers.length} platform servers${suffix} via portal gateway — no token needed).`
        );
    } else {
        console.log('✅ Created .cursor/mcp.json (Lovelace MCP servers — direct URLs).');
        console.log(
            '   ⚠️  MCP servers require AUTH0_M2M_DEV_TOKEN as a shell environment variable.'
        );
        console.log(
            '   If you have broadchurch.yaml, re-run init to use the portal proxy instead (no token needed).'
        );
    }
}

// Quick local-dev setup: creates .env with sensible defaults, no wizard.
// Reads broadchurch.yaml if present for project-specific values.
async function runLocalInit() {
    const templateVersion = getTemplateVersion();
    if (templateVersion) console.log(`Template: ${templateVersion}`);

    const rawName = path.basename(process.cwd());
    const cleanName = rawName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    let appId = cleanName;
    let displayName = cleanName
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    let queryServer = '';
    let gatewayUrl = '';
    let tenantOrgId = '';
    let auth0ClientId = '';

    const bcPath = path.join(process.cwd(), 'broadchurch.yaml');
    if (fs.existsSync(bcPath)) {
        const yaml = fs.readFileSync(bcPath, 'utf-8');
        appId = yamlSectionValue(yaml, 'tenant', 'project_name') || appId;
        displayName = yamlSectionValue(yaml, 'tenant', 'display_name') || displayName;
        queryServer = yamlSectionUrl(yaml, 'query_server');
        gatewayUrl = yamlSectionUrl(yaml, 'gateway');
        tenantOrgId = yamlSectionValue(yaml, 'tenant', 'org_id');
        auth0ClientId = yamlSectionValue(yaml, 'auth', 'client_id');
    }

    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        console.log('ℹ️  .env already exists — skipping creation.');
    } else {
        const lines = [
            `# Local development configuration (auto-generated from broadchurch.yaml)`,
            `NUXT_PUBLIC_APP_ID=${appId}`,
            `NUXT_PUBLIC_APP_NAME="${displayName}"`,
            `NUXT_PUBLIC_USER_NAME=dev-user`,
            queryServer
                ? `NUXT_PUBLIC_QUERY_SERVER_ADDRESS=${queryServer}`
                : '# NUXT_PUBLIC_QUERY_SERVER_ADDRESS=',
            gatewayUrl ? `NUXT_PUBLIC_GATEWAY_URL=${gatewayUrl}` : '# NUXT_PUBLIC_GATEWAY_URL=',
            tenantOrgId
                ? `NUXT_PUBLIC_TENANT_ORG_ID=${tenantOrgId}`
                : '# NUXT_PUBLIC_TENANT_ORG_ID=',
            auth0ClientId
                ? `NUXT_PUBLIC_AUTH0_CLIENT_ID=${auth0ClientId}`
                : '# NUXT_PUBLIC_AUTH0_CLIENT_ID=',
            '',
        ];
        fs.writeFileSync(envPath, lines.join('\n'));
        console.log('✅ Created .env with local-dev defaults (Auth0 bypassed).');
    }

    await generateMcpJson(gatewayUrl, tenantOrgId);

    // Extract Aether instructions (rules, commands, skills)
    extractAetherInstructions();

    console.log('\nReady! Run:\n');
    console.log('  npm install');
    console.log('  npm run dev\n');
}

// Show help if requested
if (args.help) {
    console.log(`
Aether Project Initializer

Usage:
  npm run init                       # Interactive wizard
  npm run init -- --local            # Quick local-dev setup (creates .env, no prompts)
  npm run init -- --non-interactive  # CI mode (used by tenant-init workflow)

Options:
  --local                      Quick setup: create .env with dev defaults and exit
  --non-interactive            Run full init without prompts (for CI)
  --name, -n <string>          Project name (default: directory name)
  --id, -i <string>            Unique app ID for preferences
  --title <string>             App display title
  --description <string>       Project description
  --query-server <string>      Query server address
  --auth0-client-id <string>   Auth0 client ID
  --auth0-client-secret <string> Auth0 client secret
  --auth0-audience <string>    Auth0 API audience
  --no-include-examples        Remove example pages (entity-lookup, chat, mcp)
  --skip-install               Skip npm install step
  --help, -h                   Show this help message

Examples:
  npm run init -- --local
  npm run init -- --non-interactive --name "My App" --id "my-app-2024"
  npm run init -- --non-interactive --skip-install --no-include-examples
`);
    process.exit(0);
}

// Main entry point
if (args.local) {
    runLocalInit().then(() => process.exit(0));
} else if (args['non-interactive']) {
    const config = {
        projectName: args.name || path.basename(process.cwd()),
        appId: args.id,
        appTitle: args.title,
        description: args.description,
        queryServer: args['query-server'],
        auth0ClientId: args['auth0-client-id'],
        auth0ClientSecret: args['auth0-client-secret'],
        auth0Audience: args['auth0-audience'],
        includeExamples: !args['no-include-examples'],
        skipInstall: args['skip-install'] || false,
    };

    const templateVersion = getTemplateVersion();
    console.log('🚀 Running Aether initialization in non-interactive mode...');
    if (templateVersion) console.log(`   Template: ${templateVersion}`);
    console.log(`   Project: ${config.projectName}`);
    console.log(`   App ID: ${config.appId || 'auto-generated'}`);

    runNonInteractiveInit(config)
        .then(() => {
            console.log('\n✅ Project initialized successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error:', error.message);
            process.exit(1);
        });
} else {
    // Interactive wizard
    init().catch((error) => {
        console.error('Error:', error);
        rl.close();
        process.exit(1);
    });
}
