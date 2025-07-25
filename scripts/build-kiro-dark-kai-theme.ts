import * as fs from 'fs'
import * as path from 'path'
import { overwriteTheme, deepMergeTheme, readThemeFile } from '../lib/theme-utils'

// Define file paths relative to the project root
const __dirname = path.dirname(new URL(import.meta.url).pathname)
const root = path.join(__dirname, '..')

const finalThemePath = path.join(root, 'themes/kiro-dark-kai-color-theme.json')

try {
    console.log('--- Generating final theme ---')

    const catppuccin = readThemeFile(path.join(root, 'vendor/catppuccin-mocha-3.17.0.json'))
    const finalTheme = deepMergeTheme(
        overwriteTheme(
            readThemeFile(finalThemePath),
            { colors: readThemeFile(path.join(root, 'vendor/kiro-dark-0.1.15.jsonc')).colors },
            { tokenColors: catppuccin.tokenColors, semanticTokenColors: catppuccin.semanticTokenColors }
        ),
        readThemeFile(path.join(root, 'vendor/catppuccin-reduce-italic.jsonc'))
    )

    fs.writeFileSync(finalThemePath, JSON.stringify(finalTheme, null, '	'), 'utf-8')
    console.log(`✅ Successfully generated final theme at ${finalThemePath}`)
} catch (error) {
    console.error('❌ An error occurred during theme generation:', error)
    process.exit(1)
}
