// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu({
    formatters: true,
    vue: true,
    typescript: true,
    stylistic: {
        indent: 4,
        quotes: 'single',
        semi: false,
    },
    markdown: true,
    rules: {
        'style/curly-newline': ['warn', {
            multiline: true,
        }],
    },
})
