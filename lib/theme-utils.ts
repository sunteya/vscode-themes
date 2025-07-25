import * as fs from 'fs'
import { parse } from 'jsonc-parser'
import _ from 'lodash'

interface TokenColor {
    scope: string[] | string
    settings: {
        foreground?: string
        fontStyle?: string
    }
}

interface Theme {
    colors: Record<string, string>
    tokenColors: TokenColor[]
    semanticHighlighting?: boolean
    semanticTokenColors?: Record<string, any>
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
        if ('semanticHighlighting' in source) {
            filteredSource.semanticHighlighting = source.semanticHighlighting
        }
        if ('semanticTokenColors' in source) {
            filteredSource.semanticTokenColors = source.semanticTokenColors
        }
        return filteredSource
    })

    const mergedTheme: Theme = { ...baseTheme }
    Object.assign(mergedTheme, ...themesToMerge)
    return mergedTheme
}

function deepMergeTokenColor(baseTokenColors: TokenColor[], newRule: TokenColor): TokenColor[] {
    const result: TokenColor[][] = []
    const scopeToIndex = new Map<string, number>()
    for (const [index, rule] of baseTokenColors.entries()) {
        const scopes = Array.isArray(rule.scope) ? rule.scope : [ rule.scope ]
        result.push([ _.cloneDeep(rule) ])

        for (const scope of scopes) {
            scopeToIndex.set(scope, index)
        }
    }

    const { scope: newScopes, settings: newSettings } = newRule

    const scopesByGroup = new Map<number | null, string[]>()
    for (const scope of Array.isArray(newScopes) ? newScopes : [ newScopes ]) {
        const index = scopeToIndex.get(scope) ?? null
        if (!scopesByGroup.has(index)) {
            scopesByGroup.set(index, [])
        }
        scopesByGroup.get(index)!.push(scope)
    }

    for (const [index, scopes] of scopesByGroup.entries()) {
        if (index === null) {
            result.push([{ scope: scopes, settings: _.cloneDeep(newSettings) }])
        } else {
            const scopesFromNewRule = scopes
            const ruleInGroup = result[index][0]
            const ruleScopes = Array.isArray(ruleInGroup.scope) ? ruleInGroup.scope : ruleInGroup.scope.split(' ')
            const scopesInGroupToModify = new Set<string>(scopesFromNewRule)

            const intersectingScopes = ruleScopes.filter(s => scopesInGroupToModify.has(s))
            const remainingScopes = ruleScopes.filter(s => !scopesInGroupToModify.has(s))

            if (remainingScopes.length > 0) {
                result[index][0] = { ...ruleInGroup, scope: remainingScopes }
            } else {
                result[index] = []
            }

            if (intersectingScopes.length > 0) {
                const mergedSettings = { ...ruleInGroup.settings, ...newSettings }
                for (const key of Object.keys(newSettings)) {
                    if ((newSettings as any)[key] === null) {
                        delete (mergedSettings as any)[key]
                    }
                }
                result[index].push({ ...ruleInGroup, scope: intersectingScopes, settings: mergedSettings })
            }
        }
    }

    return result.flat()
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
        let finalTokenColors = mergedTheme.tokenColors
        for (const newRule of source.tokenColors ?? []) {
            finalTokenColors = deepMergeTokenColor(finalTokenColors, newRule)
        }

        // 3. Smartly merge the 'semanticTokenColors' object
        const newSemanticTokenColors: Record<string, any> = { ...mergedTheme.semanticTokenColors }
        if (source.semanticTokenColors) {
            for (const [key, value] of Object.entries(source.semanticTokenColors)) {
                if (value !== undefined) {
                    newSemanticTokenColors[key] = value
                }
            }
        }

        // Update the merged theme for the next iteration
        mergedTheme = {
            ...mergedTheme,
            ...source,
            colors: newMergedColors,
            tokenColors: finalTokenColors,
            semanticTokenColors: newSemanticTokenColors,
        }
    }

    return mergedTheme
}
