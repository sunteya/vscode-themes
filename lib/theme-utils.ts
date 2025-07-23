import * as fs from 'fs'
import { parse } from 'jsonc-parser'

interface TokenColor {
    name?: string
    scope: string | string[]
    settings: {
        foreground?: string
        fontStyle?: string
    }
}

interface Theme {
    colors: Record<string, string>
    tokenColors: TokenColor[]
}

export function readThemeFile(filePath: string): Theme {
    console.log(`Reading and parsing ${filePath}...`)
    const content = fs.readFileSync(filePath, 'utf-8')
    return parse(content)
}

/**
 * Overwrites `colors` and `tokenColors` of a base theme object with properties from one or more source objects.
 * Other properties in the source objects are ignored.
 * This performs a shallow merge from left to right.
 * @param baseTheme The base theme object that will be cloned.
 * @param sources A variable number of partial theme objects. Only their `colors` and `tokenColors` properties will be merged.
 * @returns A new theme object with the merged properties.
 */
export function overwriteTheme(baseTheme: Theme, ...sources: Partial<Theme>[]): Theme {
    const themesToMerge = sources.map(source => {
        const filteredSource: Partial<Theme> = {}
        if ('colors' in source) {
            filteredSource.colors = source.colors
        }
        if ('tokenColors' in source) {
            filteredSource.tokenColors = source.tokenColors
        }
        return filteredSource
    })

    const mergedTheme: Theme = { ...baseTheme }
    Object.assign(mergedTheme, ...themesToMerge)
    return mergedTheme
}

/**
 * Deeply merges multiple new themes into a base theme with specific rules for `colors` and `tokenColors`.
 * @param baseTheme The base theme object.
 * @param sources A variable number of partial theme objects to merge.
 * @returns A new, deeply merged theme object.
 */
export function deepMergeTheme(baseTheme: Theme, ...sources: Partial<Theme>[]): Theme {
    let mergedTheme = { ...baseTheme }

    for (const source of sources) {
        // 1. Smartly merge the 'colors' object
        const newMergedColors = { ...mergedTheme.colors }
        if (source.colors) {
            for (const [key, value] of Object.entries(source.colors)) {
                if (value !== undefined) {
                    newMergedColors[key] = value
                }
            }
        }

        // 2. Intelligently merge 'tokenColors'
        const createScopeMap = (tokenColors: TokenColor[] = []): Map<string, object> => {
            const map = new Map<string, object>()
            for (const rule of tokenColors) {
                const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope]
                for (const scope of scopes) {
                    map.set(scope, rule.settings)
                }
            }
            return map
        }

        const baseScopeMap = createScopeMap(mergedTheme.tokenColors)
        const newScopeMap = createScopeMap(source.tokenColors)

        // Intelligently merge the scopes, combining settings from the new theme into the base
        for (const [scope, newSettings] of newScopeMap.entries()) {
            const oldSettings = baseScopeMap.get(scope) || {}
            baseScopeMap.set(scope, { ...oldSettings, ...newSettings })
        }

        const finalScopeMap = baseScopeMap

        const settingsToScopesMap = new Map<string, string[]>()
        for (const [scope, settings] of finalScopeMap.entries()) {
            const settingsKey = JSON.stringify(settings)
            if (!settingsToScopesMap.has(settingsKey)) {
                settingsToScopesMap.set(settingsKey, [])
            }
            settingsToScopesMap.get(settingsKey)!.push(scope)
        }

        const finalTokenColors: TokenColor[] = []
        for (const [settingsKey, scopes] of settingsToScopesMap.entries()) {
            finalTokenColors.push({
                scope: scopes.length === 1 ? scopes[0] : scopes.sort(),
                settings: JSON.parse(settingsKey),
            })
        }

        // Update the merged theme for the next iteration
        mergedTheme = {
            ...mergedTheme,
            ...source,
            colors: newMergedColors,
            tokenColors: finalTokenColors,
        }
    }

    return mergedTheme
}
