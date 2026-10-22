/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { themePalettes } from './themePalettes'

const css = readFileSync(resolve('src/style.css'), 'utf8')
  + readFileSync(resolve('src/theme-palettes.css'), 'utf8')

function colorsFor(selector: string) {
  const block = css.slice(css.indexOf(selector) + selector.length).split('}')[0]!
  return Object.fromEntries([...block.matchAll(/--app-([\w-]+): (#[\da-f]{6});/gi)].map((match) => [match[1], match[2]])) as Record<string, string>
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
  return channels.reduce((sum, channel, index) => sum
    + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    * [0.2126, 0.7152, 0.0722][index]!, 0)
}

function contrast(a: string, b: string) {
  const [min, max] = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return (max! + 0.05) / (min! + 0.05)
}

describe('palette contrast in both modes', () => {
  for (const palette of themePalettes) {
    for (const mode of ['light', 'dark']) {
      it(`${palette.id} ${mode} keeps text and primary buttons readable`, () => {
        const selector = palette.id === 'forest'
          ? (mode === 'light' ? ':root {' : ':root[data-theme="dark"] {')
          : `:root[data-palette="${palette.id}"]${mode === 'dark' ? '[data-theme="dark"]' : ':not([data-theme="dark"])'} {`
        expect(css).toContain(selector)
        const colors = colorsFor(selector)
        for (const text of ['text', 'text-muted', 'text-soft']) {
          for (const surface of ['bg', 'surface', 'surface-raised', 'surface-muted']) {
            expect(contrast(colors[text]!, colors[surface]!), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5)
          }
        }
        expect(contrast(colors.primary!, colors['primary-contrast']!)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
