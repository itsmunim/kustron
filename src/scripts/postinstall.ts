import { checkAll } from '../utils/checks.js'

async function main(): Promise<void> {
  try {
    await checkAll(['docker', 'k3d', 'kubectl'], ['railpack', 'git', 'helm'])
  } catch {
    // postinstall should never hard-crash npm install
  }
}

main()
