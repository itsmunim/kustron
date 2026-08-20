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

export class KustronExecError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode?: number,
  ) {
    super(message)
    this.name = 'KustronExecError'
  }
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
  const opts: Record<string, unknown> = {
    all: true,
    ...(options ?? {}),
  }

  if (options?.input) {
    opts.input = options.input
  }

  if (verboseMode) {
    opts.stdout = 'inherit'
    opts.stderr = 'inherit'
  }

  try {
    const result = await execa(command, args, opts as ExecaOptions)
    return {
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      exitCode: result.exitCode ?? 0,
    }
  } catch (err) {
    const ex = err as { stdout?: unknown; stderr?: unknown; message: string; command?: string; exitCode?: number }
    const message = String(ex.stderr ?? ex.stdout ?? ex.message ?? t('errors.unknownError'))
    error(
      t('errors.commandFailed', {
        command: `${command} ${args.join(' ')}`,
        message,
      }),
    )
    throw new KustronExecError(message, `${command} ${args.join(' ')}`, ex.exitCode)
  }
}
