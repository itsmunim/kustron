import chalk from 'chalk'

const prefix = {
  info: chalk.blue('ℹ'),
  success: chalk.green('✔'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✖'),
  step: chalk.cyan('→'),
}

export function info(message: string): void {
  console.log(`${prefix.info} ${message}`)
}

export function success(message: string): void {
  console.log(`${prefix.success} ${message}`)
}

export function warn(message: string): void {
  console.warn(`${prefix.warn} ${message}`)
}

export function error(message: string): void {
  console.error(`${prefix.error} ${message}`)
}

export function step(message: string): void {
  console.log(`${prefix.step} ${message}`)
}
