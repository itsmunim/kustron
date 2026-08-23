import chalk from 'chalk'

export function printBanner(): void {
  console.log()
  console.log(
    chalk.cyanBright(`
    ██╗  ██╗██╗   ██╗███████╗████████╗██████╗  ██████╗ ███╗   ██╗
    ██║ ██╔╝██║   ██║██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗████╗  ██║
    █████╔╝ ██║   ██║███████╗   ██║   ██████╔╝██║   ██║██╔██╗ ██║
    ██╔═██╗ ██║   ██║╚════██║   ██║   ██╔══██╗██║   ██║██║╚██╗██║
    ██║  ██╗╚██████╔╝███████║   ██║   ██║  ██║╚██████╔╝██║ ╚████║
    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
    `)
  )
  console.log(chalk.dim('    A CLI tool that takes you from source code to a fully'))
  console.log(chalk.dim('    running local Kubernetes environment'))
  console.log()
}
