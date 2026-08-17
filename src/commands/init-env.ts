import { exec } from '../utils/exec.js'
import { info, success, warn, error, step } from '../utils/logger.js'
import { t } from '../utils/i18n.js'
import { access, mkdir, writeFile, chmod, rm } from 'fs/promises'
import { homedir } from 'os'
import { resolve, join, basename } from 'path'
import { execa } from 'execa'

const INSTALL_DIR = resolve(homedir(), '.local', 'bin')

interface Tool {
  name: string
  command: string
  required: boolean
  canAutoInstall: boolean
  manualHint: string
  check: () => Promise<boolean>
  install: () => Promise<void>
}

async function isCommandAvailable(command: string): Promise<boolean> {
  const result = await execa('which', [command], { reject: false })
  return result.exitCode === 0
}

async function ensureInstallDir(): Promise<void> {
  try {
    await access(INSTALL_DIR)
  } catch {
    await mkdir(INSTALL_DIR, { recursive: true })
  }
}

function getPlatformArch(): { platform: string; arch: string } {
  const platform = process.platform
  const arch = process.arch === 'x64' ? 'amd64' : process.arch
  return { platform, arch }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(dest, buffer)
}

async function extractTarGz(archivePath: string, destDir: string, targetFile?: string): Promise<void> {
  if (targetFile) {
    await exec('tar', ['-xzf', archivePath, '-C', destDir, targetFile])
  } else {
    await exec('tar', ['-xzf', archivePath, '-C', destDir])
  }
}

async function cleanUp(path: string): Promise<void> {
  await rm(path, { force: true })
}

function k3dInstall(): () => Promise<void> {
  return async () => {
    const { platform, arch } = getPlatformArch()
    const version = 'v5.9.0'
    const binaryName = `k3d-${platform}-${arch}`
    const url = `https://github.com/k3d-io/k3d/releases/download/${version}/${binaryName}`
    const dest = join(INSTALL_DIR, 'k3d')
    const tempFile = `${dest}.download`

    await downloadFile(url, tempFile)
    await exec('mv', [tempFile, dest])
    await chmod(dest, 0o755)
  }
}

function kubectlInstall(): () => Promise<void> {
  return async () => {
    const { platform, arch } = getPlatformArch()
    const versionRes = await fetch('https://dl.k8s.io/release/stable.txt')
    const version = (await versionRes.text()).trim()
    const url = `https://dl.k8s.io/release/${version}/bin/${platform}/${arch}/kubectl`
    const dest = join(INSTALL_DIR, 'kubectl')
    const tempFile = `${dest}.download`

    await downloadFile(url, tempFile)
    await exec('mv', [tempFile, dest])
    await chmod(dest, 0o755)
  }
}

function buildctlInstall(): () => Promise<void> {
  return async () => {
    const { platform, arch } = getPlatformArch()
    const version = 'v0.32.2'
    const assetName = `buildkit-${version}.${platform}-${arch}.tar.gz`
    const url = `https://github.com/moby/buildkit/releases/download/${version}/${assetName}`
    const archivePath = join(INSTALL_DIR, assetName)
    const binaryPath = join(INSTALL_DIR, 'buildctl')

    await downloadFile(url, archivePath)
    await extractTarGz(archivePath, INSTALL_DIR, 'bin/buildctl')
    await exec('mv', [join(INSTALL_DIR, 'bin', 'buildctl'), binaryPath])
    await chmod(binaryPath, 0o755)
    await rm(join(INSTALL_DIR, 'bin'), { recursive: true, force: true })
    await cleanUp(archivePath)
  }
}

function railpackInstall(): () => Promise<void> {
  return async () => {
    const { platform, arch } = getPlatformArch()
    const version = 'v0.36.4'

    let assetName: string
    if (platform === 'darwin') {
      assetName = `railpack-${version}-${arch}-apple-darwin.tar.gz`
    } else {
      assetName = `railpack-${version}-${arch}-unknown-linux-gnu.tar.gz`
    }

    const url = `https://github.com/railwayapp/railpack/releases/download/${version}/${assetName}`
    const archivePath = join(INSTALL_DIR, assetName)
    const binaryPath = join(INSTALL_DIR, 'railpack')

    await downloadFile(url, archivePath)
    await extractTarGz(archivePath, INSTALL_DIR)
    const extractedName = platform === 'darwin' ? 'railpack' : 'railpack'
    const extractedPath = join(INSTALL_DIR, extractedName)
    await chmod(extractedPath, 0o755)
    await cleanUp(archivePath)
  }
}

function gitInstall(): () => Promise<void> {
  return async () => {
    throw new Error(t('initEnv.manualInstall', { name: 'git', hint: 'brew install git or use your system package manager' }))
  }
}

function dockerInstall(): () => Promise<void> {
  return async () => {
    throw new Error(t('initEnv.manualInstall', { name: 'docker', hint: 'Install OrbStack (https://orbstack.dev) or Docker Desktop' }))
  }
}

const tools: Tool[] = [
  {
    name: 'docker',
    command: 'docker',
    required: true,
    canAutoInstall: false,
    manualHint: 'Install OrbStack (https://orbstack.dev) or Docker Desktop',
    check: () => isCommandAvailable('docker'),
    install: dockerInstall(),
  },
  {
    name: 'k3d',
    command: 'k3d',
    required: true,
    canAutoInstall: true,
    manualHint: 'brew install k3d',
    check: () => isCommandAvailable('k3d'),
    install: k3dInstall(),
  },
  {
    name: 'kubectl',
    command: 'kubectl',
    required: true,
    canAutoInstall: true,
    manualHint: 'brew install kubectl',
    check: () => isCommandAvailable('kubectl'),
    install: kubectlInstall(),
  },
  {
    name: 'buildctl',
    command: 'buildctl',
    required: false,
    canAutoInstall: true,
    manualHint: 'docker run --rm --privileged -d --name buildkit moby/buildkit',
    check: () => isCommandAvailable('buildctl'),
    install: buildctlInstall(),
  },
  {
    name: 'railpack',
    command: 'railpack',
    required: false,
    canAutoInstall: true,
    manualHint: 'See https://railpack.io',
    check: () => isCommandAvailable('railpack'),
    install: railpackInstall(),
  },
  {
    name: 'git',
    command: 'git',
    required: false,
    canAutoInstall: false,
    manualHint: 'brew install git',
    check: () => isCommandAvailable('git'),
    install: gitInstall(),
  },
]

export async function initEnv(): Promise<void> {
  step(t('initEnv.checking'))

  const pathEnv = process.env.PATH ?? ''
  const pathDirs = pathEnv.split(':')
  const installDirInPath = pathDirs.includes(INSTALL_DIR)

  if (!installDirInPath) {
    warn(t('initEnv.pathWarning', { dir: INSTALL_DIR }))
  }

  await ensureInstallDir()

  const results: Array<{
    name: string
    required: boolean
    wasInstalled: boolean
    installedNow: boolean
    failed: boolean
    error?: string
  }> = []

  for (const tool of tools) {
    const wasInstalled = await tool.check()

    if (wasInstalled) {
      info(t('initEnv.alreadyInstalled', { name: tool.name }))
      results.push({
        name: tool.name,
        required: tool.required,
        wasInstalled: true,
        installedNow: false,
        failed: false,
      })
      continue
    }

    if (!tool.canAutoInstall) {
      warn(t('initEnv.manualInstall', { name: tool.name, hint: tool.manualHint }))
      results.push({
        name: tool.name,
        required: tool.required,
        wasInstalled: false,
        installedNow: false,
        failed: true,
        error: tool.manualHint,
      })
      continue
    }

    info(t('initEnv.installing', { name: tool.name }))
    try {
      await tool.install()
      success(t('initEnv.installed', { name: tool.name }))
      results.push({
        name: tool.name,
        required: tool.required,
        wasInstalled: false,
        installedNow: true,
        failed: false,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error(t('initEnv.failed', { name: tool.name }))
      warn(message)
      results.push({
        name: tool.name,
        required: tool.required,
        wasInstalled: false,
        installedNow: false,
        failed: true,
        error: message,
      })
    }
  }

  console.log()
  step(t('initEnv.summaryHeader'))

  const requiredFailed = results.filter((r) => r.required && r.failed)
  const optionalFailed = results.filter((r) => !r.required && r.failed)
  const newlyInstalled = results.filter((r) => r.installedNow)

  if (newlyInstalled.length > 0) {
    success(
      t('initEnv.newlyInstalled', { count: String(newlyInstalled.length), names: newlyInstalled.map((r) => r.name).join(', ') }),
    )
  }

  if (requiredFailed.length > 0) {
    error(t('initEnv.requiredFailed', { names: requiredFailed.map((r) => r.name).join(', ') }))
    for (const r of requiredFailed) {
      const tool = tools.find((t) => t.name === r.name)
      if (tool) {
        info(t('initEnv.manualInstall', { name: tool.name, hint: tool.manualHint }))
      }
    }
  }

  if (optionalFailed.length > 0) {
    warn(t('initEnv.optionalFailed', { names: optionalFailed.map((r) => r.name).join(', ') }))
  }

  if (requiredFailed.length === 0 && newlyInstalled.length > 0) {
    success(t('initEnv.allInstalled'))
  }

  if (!installDirInPath) {
    console.log()
    warn(t('initEnv.pathReminder', { dir: INSTALL_DIR }))
  }
}
