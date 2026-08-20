import { renderSpec } from '../../core/env-file.js'

export async function envShowSpec(): Promise<void> {
  console.log(renderSpec())
}
