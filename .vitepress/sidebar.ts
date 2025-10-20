import type { DefaultTheme } from 'vitepress/theme'

// @TODO: Auto generate sidebar
export const sidebar = [
    { text: '首页', link: '/' },
    { text: '简介', link: '/introduce' },
    { text: '贡献指南', link: '/how-to-contribute' },
    { text: '密码学基础', items: [] },
    { text: 'Move 合约', items: [
        { text: '编程技巧', items: [] },
        { text: '版本控制', items: [] },
        { text: '安全实践', items: [
            {
                text: 'entry&public',
                link: '/entry-public/use-entry-public.md'
            }
        ] },
    ] },
    {
        text: 'SUI SDKs',
        items: [
            {
                text: 'Go',
                link: '/sui-sdks/go/go-sui-ctf',
            },
        ],
    },
    { text: 'BCS详解', items: [] },
    { text: '链上查询', items: [] },
    { text: '实用工具', items: [] },
] satisfies DefaultTheme.Config['sidebar']
