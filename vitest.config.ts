import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['json', 'text'],
            exclude: ['test', 'examples'],
        },
    },
})
