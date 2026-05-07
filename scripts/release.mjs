import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const bumpType = process.argv[2] ?? 'patch'

execSync('pnpm lint', { stdio: 'inherit' })
execSync(`pnpm version ${bumpType} --no-git-tag-version`, { stdio: 'inherit' })

const { version } = require('../package.json')
writeFileSync('src/version.ts', `export const version = '${version}'\n`)

execSync('git add package.json src/version.ts', { stdio: 'inherit' })
execSync(`git commit -m "${version}"`, { stdio: 'inherit' })
execSync(`git tag -a "v${version}" -m "v${version}"`, { stdio: 'inherit' })
execSync('git push --follow-tags', { stdio: 'inherit' })
