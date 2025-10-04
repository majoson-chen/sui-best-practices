// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu({
    formatters: true,
    vue: true,
    stylistic: {
        indent: 4,
        quotes: 'single',
        semi: false,
        overrides: {
            'style/curly-newline': ['warn', {
                multiline: true,
            }],
        },
    },
})
