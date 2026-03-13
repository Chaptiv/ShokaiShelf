import fs from 'fs-extra';
import path from 'path';
import { select, input, confirm, checkbox, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import semver from 'semver';
import shell from 'shelljs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function main() {
    while (true) {
        const pkg = await fs.readJson(path.join(projectRoot, 'package.json'));
        console.log(chalk.blue.bold(`\n🚀 ShokaiShelf Unified Release CLI (Current Version: v${pkg.version})`));

        const action = await select({
            message: 'What would you like to do?',
            choices: [
                { name: '📈 Bump Version', value: 'bump' },
                { name: '📦 Build & Prepare Release (Windows + macOS)', value: 'build' },
                new Separator(),
                { name: '❌ Exit', value: 'exit' }
            ]
        });

        if (action === 'exit') break;
        if (action === 'bump') await bumpVersion();
        if (action === 'build') await buildAndPrepare();
    }
}

async function bumpVersion() {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const pkg = await fs.readJson(packageJsonPath);
    const currentVersion = pkg.version;

    console.log(chalk.cyan(`Current Version: ${currentVersion}`));

    const bumpType = await select({
        message: 'Select version bump type:',
        choices: [
            { name: 'patch (0.0.x)', value: 'patch' },
            { name: 'minor (0.x.0)', value: 'minor' },
            { name: 'major (x.0.0)', value: 'major' },
            { name: 'hotfix (0.x.x.x)', value: 'hotfix' },
            { name: 'custom', value: 'custom' }
        ]
    });

    let newVersion;
    if (bumpType === 'hotfix') {
        const parts = currentVersion.split('.');
        if (parts.length === 3) {
            newVersion = `${currentVersion}.1`;
        } else if (parts.length === 4) {
            const patchNum = parseInt(parts[3], 10) + 1;
            newVersion = `${parts[0]}.${parts[1]}.${parts[2]}.${patchNum}`;
        } else {
            newVersion = `${currentVersion}.1`;
        }
    } else if (bumpType === 'custom') {
        const customVer = await input({
            message: 'Enter custom version (e.g. 0.2.1 or 0.2.1.1):',
            validate: (val) => {
                const isValidStrict = semver.valid(val) !== null;
                const isValid4Digit = /^\d+\.\d+\.\d+\.\d+$/.test(val);
                return (isValidStrict || isValid4Digit) ? true : 'Invalid version format';
            }
        });
        newVersion = customVer;
    } else {
        newVersion = semver.inc(currentVersion, bumpType);
    }

    const doConfirm = await confirm({
        message: `Bump version from ${currentVersion} to ${newVersion}?`,
        default: true
    });

    if (!doConfirm) return;

    // 1. Update package.json
    pkg.version = newVersion;
    await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
    console.log(chalk.green('✓ Updated package.json'));

    // 2. Update NOTIFICATIONS.md
    const notificationsPath = path.join(projectRoot, 'NOTIFICATIONS.md');
    if (await fs.pathExists(notificationsPath)) {
        let content = await fs.readFile(notificationsPath, 'utf8');
        content = content.replace(/\*\*Version\*\*: .*/g, `**Version**: ${newVersion}`);
        await fs.writeFile(notificationsPath, content);
        console.log(chalk.green('✓ Updated NOTIFICATIONS.md'));
    }

    // 3. Update README.md
    const readmePath = path.join(projectRoot, 'README.md');
    if (await fs.pathExists(readmePath)) {
        let content = await fs.readFile(readmePath, 'utf8');
        content = content.replace(/Public Beta \d+\.\d+\.\d+/g, `Public Beta ${newVersion}`);
        content = content.replace(/v\d+\.\d+\.\d+ Public Beta/g, `v${newVersion} Public Beta`);
        await fs.writeFile(readmePath, content);
        console.log(chalk.green('✓ Updated README.md'));
    }

    // 4. Update Custom Installer variables
    const installerIpcPath = path.resolve(projectRoot, '..', 'ShokaiShelf-Installer', 'electron', 'ipc-handlers.ts');
    if (await fs.pathExists(installerIpcPath)) {
        let content = await fs.readFile(installerIpcPath, 'utf8');
        // Update const APP_VERSION = '...';
        content = content.replace(/const APP_VERSION = '[\d\.]+';/g, `const APP_VERSION = '${newVersion}';`);
        // Update dev payloadPath target just in case
        content = content.replace(/release', '[\d\.]+', 'win-unpacked'/g, `release', '${newVersion}', 'win-unpacked'`);
        await fs.writeFile(installerIpcPath, content);
        console.log(chalk.green('✓ Updated Installer (ipc-handlers.ts)'));
    }

    // 5. Update Installer package.json early
    const installerPkgPath = path.resolve(projectRoot, '..', 'ShokaiShelf-Installer', 'package.json');
    if (await fs.pathExists(installerPkgPath)) {
        const iPkg = await fs.readJson(installerPkgPath);
        iPkg.version = newVersion;
        await fs.writeJson(installerPkgPath, iPkg, { spaces: 2 });
    }

    // Git Commit & Tag
    const doGit = await confirm({
        message: 'Do you want to commit and tag this version?',
        default: true
    });

    if (doGit) {
        shell.cd(projectRoot);
        if (shell.exec(`git add .`).code !== 0) {
            console.log(chalk.red('Error adding files'));
        } else if (shell.exec(`git commit -m "chore: bump version to ${newVersion}"`).code !== 0) {
            console.log(chalk.red('Error committing'));
        } else {
            console.log(chalk.green('✓ Git commit created'));
            if (shell.exec(`git tag v${newVersion}`).code === 0) {
                console.log(chalk.green(`✓ Git tag v${newVersion} created`));
            }
        }
    }
}

async function buildAndPrepare() {
    const targets = await checkbox({
        message: 'Which platforms do you want to build?',
        choices: [
            { name: 'macOS (ARM + x64)', value: 'mac' },
            { name: 'Windows (Custom Installer)', value: 'win' }
        ],
        validate: (ans) => ans.length > 0 ? true : 'Must select at least one platform.'
    });

    const changelogPathInput = await input({
        message: 'Drag & drop a Markdown file for Release Notes/Changelog (or press Enter to skip):'
    });

    const pkg = await fs.readJson(path.join(projectRoot, 'package.json'));
    const version = pkg.version;
    const uploadPrepDir = path.join(projectRoot, 'artifacts');
    await fs.emptyDir(uploadPrepDir); // Always clear out old artifacts

    const releaseDir = path.join(projectRoot, 'release');
    if (await fs.pathExists(releaseDir)) {
        console.log(chalk.yellow('Cleaning up old release directory...'));
        await fs.emptyDir(releaseDir);
    }

    let injectedReleaseNotes = false;
    if (changelogPathInput.trim()) {
        const parsedPath = changelogPathInput.trim().replace(/^['"]|['"]$/g, '').replace(/\\ /g, ' ').trim();
        if (await fs.pathExists(parsedPath)) {
            const content = await fs.readFile(parsedPath, 'utf8');
            await fs.writeFile(path.join(projectRoot, 'release-notes.md'), content);
            console.log(chalk.green(`✓ Injected release notes from ${path.basename(parsedPath)}`));
            injectedReleaseNotes = true;
        } else {
            console.log(chalk.yellow(`⚠️ Could not find file at ${parsedPath}, skipping release notes.`));
        }
    }

    console.log(chalk.yellow('\nStarting Build Process...'));
    shell.cd(projectRoot);

    // Always build renderer first
    console.log(chalk.cyan('Building Main App (Renderer)...'));
    if (shell.exec('npm run build:renderer').code !== 0) {
        console.log(chalk.red('Renderer build failed!'));
        return;
    }

    if (targets.includes('mac')) {
        console.log(chalk.cyan('\nBuilding macOS (arm64 + x64)...'));
        // Use default config in electron-builder.json5 for Mac (targets both if configured)
        if (shell.exec('npx electron-builder --mac').code !== 0) {
            console.log(chalk.red('macOS build failed!'));
            return;
        }

        // Copy macOS artifacts (only DMG for 0.2.2)
        const releaseDir = path.join(projectRoot, 'release', version);
        if (await fs.pathExists(releaseDir)) {
            let count = 0;
            const files = await fs.readdir(releaseDir);
            for (const file of files) {
                if (file.endsWith('.dmg')) {
                    await fs.copy(path.join(releaseDir, file), path.join(uploadPrepDir, file));
                    console.log(chalk.green(`✓ Collected ${file}`));
                    count++;
                }
            }
            if (count === 0) console.log(chalk.yellow('⚠️ No macOS DMG found to collect.'));
        } else {
            console.log(chalk.red(`macOS release directory not found at: ${releaseDir}`));
        }
    }

    if (targets.includes('win')) {
        console.log(chalk.cyan('\nBuilding Windows Payload (win-unpacked)...'));
        // For 0.2.2 we don't need nsis-web auto-updater payload, just the win-unpacked folder
        // for the Custom Installer to wrap.
        if (shell.exec(`npx electron-builder --win dir --x64`).code !== 0) {
            console.log(chalk.red('Windows payload build failed!'));
            return;
        }

        console.log(chalk.cyan('Syncing with Installer Project...'));
        const installerDir = path.resolve(projectRoot, '..', 'ShokaiShelf-Installer');
        if (!await fs.pathExists(installerDir)) {
            console.log(chalk.red(`Installer project not found at: ${installerDir}`));
            return;
        }

        try {
            // Sync package.json
            const installerPkgPath = path.join(installerDir, 'package.json');
            if (await fs.pathExists(installerPkgPath)) {
                const iPkg = await fs.readJson(installerPkgPath);
                iPkg.version = version;
                await fs.writeJson(installerPkgPath, iPkg, { spaces: 2 });
                console.log(chalk.green(`✓ Synced version ${version} to Installer`));
            }

            // Sync electron-builder.json5
            const installerConfigPath = path.join(installerDir, 'electron-builder.json5');
            if (await fs.pathExists(installerConfigPath)) {
                let configContent = await fs.readFile(installerConfigPath, 'utf8');

                const regex = /"from":\s*"\.\.\/[^/]+\/release\/[\d\.]+\/win-unpacked"/g;
                const newFrom = `"from": "../${path.basename(projectRoot)}/release/${version}/win-unpacked"`;

                if (regex.test(configContent)) {
                    configContent = configContent.replace(regex, newFrom);
                    await fs.writeFile(installerConfigPath, configContent);
                    console.log(chalk.green(`✓ Updated Installer config path to ${newFrom}`));
                } else {
                    console.log(chalk.yellow('⚠️ Could not find "from" target in Installer config! Make sure payload source is correct.'));
                }
            }
        } catch (err) {
            console.error(chalk.red('Sync failed:', err));
            return;
        }

        console.log(chalk.cyan('Building Custom Windows Installer...'));
        shell.cd(installerDir);
        // Quick npm install in installer to make sure
        if (shell.exec('npm install').code !== 0) {
            console.log(chalk.red('Failed to install installer deps, attempting build anyway...'));
        }
        if (shell.exec('npm run build').code !== 0) {
            console.log(chalk.red('Windows Installer build failed!'));
            shell.cd(projectRoot);
            return;
        }

        // Collect Custom Installer Artifact
        const installerReleaseDir = path.join(installerDir, 'release');
        let generatedWindowsExe = null;
        if (await fs.pathExists(installerReleaseDir)) {
            let count = 0;
            const files = await fs.readdir(installerReleaseDir);
            for (const file of files) {
                // We ONLY want the custom installer .exe here. We explicitly ignore yml/blockmap from the Custom Installer
                // because the auto-updater must use the main app's latest.yml
                if (file.endsWith('.exe')) {
                    await fs.copy(path.join(installerReleaseDir, file), path.join(uploadPrepDir, file));
                    console.log(chalk.green(`✓ Collected Custom Installer: ${file}`));
                    if (file.endsWith('.exe')) generatedWindowsExe = file;
                    count++;
                }
            }
            if (count === 0) console.log(chalk.yellow('⚠️ No Windows Custom Installer found.'));
        }

        // WE DO NOT MANUALLY RE-WRITE LATEST.YML HERE.
        // The one generated by nsis-web is exactly what the updater needs.

        // Also: Make sure package.json generation config for GitHub release doesn't break.
        // The `npm run release` you mentioned with changelog might be tied to your conventional commits.
        // We'll leave `shell.cd(projectRoot)` intact.

        shell.cd(projectRoot);
    }

    // Copy CHANGELOG.md to artifacts so it can be uploaded to the update server
    // The app fetches this file to display release notes in the Update Banner
    const changelogSrc = path.join(projectRoot, 'CHANGELOG.md');
    if (await fs.pathExists(changelogSrc)) {
        await fs.copy(changelogSrc, path.join(uploadPrepDir, 'CHANGELOG.md'));
        console.log(chalk.green('✓ Copied CHANGELOG.md to artifacts (for in-app release notes)'));
    }

    console.log(chalk.bold.magenta('\n✅ Build & Preparation Complete!'));
    console.log(chalk.white(`Files are ready in: ${uploadPrepDir}`));
    console.log(chalk.yellow('ACTION REQUIRED: Upload these files to your update server.'));

    if (injectedReleaseNotes) {
        await fs.remove(path.join(projectRoot, 'release-notes.md')).catch(() => { });
    }
}

main().catch(err => console.error(err));
