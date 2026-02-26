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
            { name: 'patch', value: 'patch' },
            { name: 'minor', value: 'minor' },
            { name: 'major', value: 'major' },
            { name: 'custom', value: 'custom' }
        ]
    });

    let newVersion;
    if (bumpType === 'custom') {
        const customVer = await input({
            message: 'Enter custom version:',
            validate: (val) => semver.valid(val) ? true : 'Invalid semantic version'
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

    const pkg = await fs.readJson(path.join(projectRoot, 'package.json'));
    const version = pkg.version;
    const uploadPrepDir = path.join(projectRoot, 'artifacts');
    await fs.ensureDir(uploadPrepDir);

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

        // Copy macOS artifacts
        const releaseDir = path.join(projectRoot, 'release', version);
        if (await fs.pathExists(releaseDir)) {
            let count = 0;
            const files = await fs.readdir(releaseDir);
            for (const file of files) {
                if (file.endsWith('.dmg') || file.endsWith('.zip') || file.endsWith('.blockmap') || file.endsWith('.yml')) {
                    await fs.copy(path.join(releaseDir, file), path.join(uploadPrepDir, file));
                    console.log(chalk.green(`✓ Collected ${file}`));
                    count++;
                }
            }
            if (count === 0) console.log(chalk.yellow('⚠️ No macOS artifacts found to collect.'));
        } else {
            console.log(chalk.red(`macOS release directory not found at: ${releaseDir}`));
        }
    }

    if (targets.includes('win')) {
        console.log(chalk.cyan('\nBuilding Windows Main App (Unpacked)...'));
        if (shell.exec(`npx electron-builder --win --dir --x64`).code !== 0) {
            console.log(chalk.red('Windows Unpacked build failed!'));
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

        // Collect Windows Artifacts
        const installerReleaseDir = path.join(installerDir, 'release');
        let generatedWindowsExe = null;
        if (await fs.pathExists(installerReleaseDir)) {
            let count = 0;
            const files = await fs.readdir(installerReleaseDir);
            for (const file of files) {
                if (file.endsWith('.exe') || file.endsWith('.yml') || file.endsWith('.blockmap')) {
                    await fs.copy(path.join(installerReleaseDir, file), path.join(uploadPrepDir, file));
                    console.log(chalk.green(`✓ Collected ${file}`));
                    if (file.endsWith('.exe')) generatedWindowsExe = file;
                    count++;
                }
            }
            if (count === 0) console.log(chalk.yellow('⚠️ No Windows artifacts found to collect.'));
        }

        // Generate latest.yml for Windows Update Server if using Portable Installer
        if (generatedWindowsExe) {
            const exePath = path.join(uploadPrepDir, generatedWindowsExe);
            const exeBuffer = await fs.readFile(exePath);
            const sha512 = crypto.createHash('sha512').update(exeBuffer).digest('base64');
            const stats = await fs.stat(exePath);

            const latestYmlContent = [
                `version: ${version}`,
                `files:`,
                `  - url: ${generatedWindowsExe}`,
                `    sha512: ${sha512}`,
                `    size: ${stats.size}`,
                `path: ${generatedWindowsExe}`,
                `sha512: ${sha512}`,
                `releaseDate: '${new Date().toISOString()}'`
            ].join('\\n');

            await fs.writeFile(path.join(uploadPrepDir, 'latest.yml'), latestYmlContent);
            console.log(chalk.green('✓ Generated latest.yml for Auto-Updater'));
        }

        shell.cd(projectRoot);
    }

    console.log(chalk.bold.magenta('\n✅ Build & Preparation Complete!'));
    console.log(chalk.white(`Files are ready in: ${uploadPrepDir}`));
    console.log(chalk.yellow('ACTION REQUIRED: Upload these files to your update server.'));
}

main().catch(err => console.error(err));
