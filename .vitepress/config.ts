import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'
// import { sidebar } from './sidebar'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    srcDir: 'docs',

    title: 'SUI最佳实践',
    description: '社区驱动的 SUI 食谱,早点下班!',
    themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: '首页', link: '/' },
            { text: '贡献指南', link: '/how-to-contribute' },
        ],

        sidebar: generateSidebar({
            documentRootPath: 'docs',
            useTitleFromFileHeading: true,
            useFolderTitleFromIndexFile: true,
        }),

        socialLinks: [
            { icon: 'github', link: 'https://github.com/majoson-chen/sui-best-practices/' },
        ],
    },
})
