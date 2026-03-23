#!/usr/bin/env node

/**
 * Copies skill files from npm packages listed in skill-packages.json
 * into skills/<directory>/. Run via postinstall (npm run copy-skills).
 *
 * Manifest: JSON array of either:
 *   - "@scope/package-name" — target dir is the package basename with a
 *     trailing "-skill" suffix removed if present (e.g. …/elemental-api-skill → elemental-api)
 *   - { "package": "@scope/name", "directory": "optional-override" }
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const manifestPath = path.join(rootDir, 'skill-packages.json');

/**
 * @param {string} pkg
 * @param {string | undefined} explicit
 * @returns {string}
 */
function targetDirectory(pkg, explicit) {
    if (explicit && String(explicit).trim()) return explicit;
    const base = pkg.split('/').pop() || pkg;
    if (base.endsWith('-skill')) {
        return base.slice(0, -'-skill'.length);
    }
    return base;
}

/**
 * @param {string} dir
 * @returns {number}
 */
function countFiles(dir) {
    let n = 0;
    const walk = (d) => {
        for (const name of fs.readdirSync(d)) {
            const p = path.join(d, name);
            const st = fs.statSync(p);
            if (st.isDirectory()) walk(p);
            else n += 1;
        }
    };
    walk(dir);
    return n;
}

if (!fs.existsSync(manifestPath)) {
    console.warn('Warning: skill-packages.json not found, skipping skill copy');
    process.exit(0);
}

let raw;
try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch {
    console.warn('Warning: skill-packages.json is invalid JSON, skipping skill copy');
    process.exit(0);
}

if (!Array.isArray(raw)) {
    console.warn('Warning: skill-packages.json must be a JSON array, skipping skill copy');
    process.exit(0);
}

if (raw.length === 0) {
    console.warn('Warning: No packages listed in skill-packages.json');
    process.exit(0);
}

const nodeModulesDir = path.join(rootDir, 'node_modules');
const skillsDir = path.join(rootDir, 'skills');

let totalFiles = 0;
let copiedCount = 0;

for (const entry of raw) {
    let pkg;
    let dirOverride;
    if (typeof entry === 'string') {
        pkg = entry;
    } else if (entry && typeof entry === 'object' && typeof entry.package === 'string') {
        pkg = entry.package;
        dirOverride = entry.directory;
    } else {
        console.warn(`Warning: skipping invalid manifest entry: ${JSON.stringify(entry)}`);
        continue;
    }

    const pkgPath = path.join(nodeModulesDir, ...pkg.split('/'));
    const sourceDir = path.join(pkgPath, 'skill');
    const targetName = targetDirectory(pkg, dirOverride);
    const targetDir = path.join(skillsDir, targetName);

    if (!fs.existsSync(sourceDir)) {
        console.warn(`Warning: ${pkg} not installed or has no skill/ directory, skipping`);
        continue;
    }

    fs.mkdirSync(skillsDir, { recursive: true });
    if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true });
    }
    fs.cpSync(sourceDir, targetDir, { recursive: true });

    const fileCount = countFiles(targetDir);
    console.log(`  ${targetName}: ${fileCount} files (${pkg})`);
    totalFiles += fileCount;
    copiedCount++;
}

console.log(`Copied ${totalFiles} files from ${copiedCount} packages to skills/`);
