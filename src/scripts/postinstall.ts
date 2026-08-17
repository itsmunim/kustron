import { runChecks } from '../utils/checks.js'

async function main(): Promise<void> {
  try {
    await runChecks()
  } catch {
    // Never hard-crash npm install; just print the table
    process.exit(0)
  }
}

main()
