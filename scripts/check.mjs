import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const json = (file) => JSON.parse(read(file))
const pkg = json('package.json')
const plugin = json('docs/index.json').plugins[0]
const locales = { en: json('locale/en.json'), zh: json('locale/zh.json') }

// npm can choose a translated README.* over README.md. Keep one canonical candidate.
const readmeCandidates = fs.readdirSync(root).filter((file) => /^readme(?:\..*)?$/i.test(file))
assert.deepEqual(readmeCandidates, ['README.md'], 'npm must have one default README candidate')
assert.ok(pkg.files.includes('README-zh-CN.md'), 'Include the Chinese documentation in the package')
assert.equal(plugin.name, pkg.name)
assert.equal(plugin.versions[0].version, pkg.version)
for (const lang of ['en', 'zh']) assert.equal(plugin.title[lang], locales[lang].meta.title)
for (const exported of ['./index.js', './client.js', pkg.exports['./icon']]) {
  assert.ok(fs.existsSync(path.join(root, exported)), `Missing export: ${exported}`)
}
assert.ok(fs.existsSync(path.resolve(root, 'docs', plugin.icon)), 'Missing marketplace icon')
assert.ok(fs.statSync(path.join(root, pkg.exports['./icon'])).size <= 256 * 1024, 'Plugin icon must not exceed DSH’s 256 KiB limit')
assert.match(read('cordis.patch.yml'), new RegExp(`id: ${pkg.name}\\n\\s+name: '${pkg.name}'`))

let client
vm.runInNewContext(read('client.js'), { window: { __ModuleLoader__: { load(value) { client = value } } } })
assert.equal(client.id, pkg.name)
assert.equal(typeof client.factory, 'function')

const repo = `https://github.com/Fyerl/${pkg.name}/blob/main/`
const raw = `https://raw.githubusercontent.com/Fyerl/${pkg.name}/main/`
for (const [file, headings] of [
  ['README.md', ['Demo', 'Quick start', `What is ${locales.en.meta.title}?`]],
  ['README-zh-CN.md', ['演示', '快速接入', `${locales.zh.meta.title}是什么？`]],
]) {
  const text = read(file)
  assert.deepEqual([...text.matchAll(/^## (.+)$/gm)].map((match) => match[1]), headings)
  assert.ok(text.includes(`dsh plugin --profile web add ${pkg.name}`), 'CLI example needs an explicit profile')
  assert.ok(text.includes('https://github.com/user-attachments/assets/'), 'Use an inline video attachment')
  for (const match of text.matchAll(/\]\(([^)]+)\)|src="([^"]+)"/g)) {
    const target = match[1] || match[2]
    const prefix = [repo, raw].find((value) => target.startsWith(value))
    if (prefix) assert.ok(fs.existsSync(path.join(root, target.slice(prefix.length))), `Broken repository link: ${target}`)
    else if (target.startsWith('./')) assert.ok(fs.existsSync(path.join(root, target)), `Broken local link: ${target}`)
  }
}

execFileSync(process.execPath, ['--check', path.join(root, 'client.js')], { stdio: 'inherit' })
await import(new URL('../index.js', import.meta.url))
console.log('Release metadata, default language, README links, plugin identity, syntax and entry module OK')
