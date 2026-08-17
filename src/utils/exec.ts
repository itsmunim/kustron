import { execa, type Options as ExecaOptions } from 'execa'
import { error } from './logger.js'
import { t } from './i18n.js'

let verboseMode = false

export function setVerbose(verbose: boolean): void {
  verboseMode = verbose
}

export function isVerbose(): boolean {
  return verboseMode
}

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function exec(
  command: string,
  args: string[],
  options?: { input?: string } & Omit<ExecaOptions, 'input'>,
): Promise<ExecResult> {
  const opts: ExecaOptions = {
    ...options,
    all: true,
  }

  if (options?.input) {
    opts.input = options.input
  }

  if (verboseMode) {
    opts.stdout = 'inherit'
    opts.stderr = 'inherit'
  }

  try {
    const result = await execa(command, args, opts)
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.exitCode ?? 0,
    }
  } catch (err) {
    const ex = err as { stdout?: string; stderr?: string; message: string; command?: string }
    const message = ex.stderr || ex.stdout || ex.message || t('errors.unknownError')
    error(
      t('errors.commandFailed', {
        command: `${command} ${args.join(' ')}`,
        message,
      }),
    )
    throw new Error(message)
  }
}
