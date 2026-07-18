import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const production = !process.env.ROLLUP_WATCH;

// Banner with version info
const banner = `/*!
 * Eutexa SDK v${packageJson.version}
 * (c) ${new Date().getFullYear()} Eutexa
 * Released under the MIT License.
 */`;

export default [
    // Main builds (UMD, ESM, CJS)
    {
        input: 'src/index.ts',
        output: [
            // UMD build for <script> tag (minified)
            {
                file: 'dist/eutexa.umd.min.js',
                format: 'umd',
                name: 'Eutexa',
                banner,
                sourcemap: true,
                plugins: production ? [terser({
                    format: {
                        comments: /^!/,
                    },
                })] : [],
            },
            // UMD build for <script> tag (unminified for debugging)
            {
                file: 'dist/eutexa.umd.js',
                format: 'umd',
                name: 'Eutexa',
                banner,
                sourcemap: true,
            },
            // ESM build for modern bundlers
            {
                file: 'dist/eutexa.esm.js',
                format: 'esm',
                banner,
                sourcemap: true,
            },
            // CJS build for Node.js / older bundlers
            {
                file: 'dist/eutexa.cjs.js',
                format: 'cjs',
                banner,
                sourcemap: true,
                exports: 'named',
            },
        ],
        plugins: [
            resolve({
                browser: true,
            }),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: false, // We generate declarations separately
            }),
        ],
    },

    // React integration builds (ESM, CJS)
    {
        input: 'src/react.tsx',
        output: [
            {
                file: 'dist/react.esm.js',
                format: 'esm',
                banner,
                sourcemap: true,
            },
            {
                file: 'dist/react.cjs.js',
                format: 'cjs',
                banner,
                sourcemap: true,
                exports: 'named',
            },
        ],
        external: ['react', 'react/jsx-runtime'],
        plugins: [
            resolve({
                browser: true,
            }),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: false,
            }),
        ],
    },

    // TypeScript declarations - main
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/index.d.ts',
            format: 'es',
        },
        plugins: [dts()],
    },

    // TypeScript declarations - react
    {
        input: 'src/react.tsx',
        output: {
            file: 'dist/react.d.ts',
            format: 'es',
        },
        external: ['react'],
        plugins: [dts()],
    },

    // Vue integration builds (ESM, CJS)
    {
        input: 'src/vue.ts',
        output: [
            {
                file: 'dist/vue.esm.js',
                format: 'esm',
                banner,
                sourcemap: true,
            },
            {
                file: 'dist/vue.cjs.js',
                format: 'cjs',
                banner,
                sourcemap: true,
                exports: 'named',
            },
        ],
        external: ['vue'],
        plugins: [
            resolve({
                browser: true,
            }),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: false,
            }),
        ],
    },

    // TypeScript declarations - vue
    {
        input: 'src/vue.ts',
        output: {
            file: 'dist/vue.d.ts',
            format: 'es',
        },
        external: ['vue'],
        plugins: [dts()],
    },

    // Angular integration builds (ESM, CJS)
    {
        input: 'src/angular.ts',
        output: [
            {
                file: 'dist/angular.esm.js',
                format: 'esm',
                banner,
                sourcemap: true,
            },
            {
                file: 'dist/angular.cjs.js',
                format: 'cjs',
                banner,
                sourcemap: true,
                exports: 'named',
            },
        ],
        external: ['@angular/core'],
        plugins: [
            resolve({
                browser: true,
            }),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: false,
            }),
        ],
    },

    // TypeScript declarations - angular
    {
        input: 'src/angular.ts',
        output: {
            file: 'dist/angular.d.ts',
            format: 'es',
        },
        external: ['@angular/core'],
        plugins: [dts()],
    },

    // Svelte integration builds (ESM, CJS)
    {
        input: 'src/svelte.ts',
        output: [
            {
                file: 'dist/svelte.esm.js',
                format: 'esm',
                banner,
                sourcemap: true,
            },
            {
                file: 'dist/svelte.cjs.js',
                format: 'cjs',
                banner,
                sourcemap: true,
                exports: 'named',
            },
        ],
        external: ['svelte', 'svelte/store'],
        plugins: [
            resolve({
                browser: true,
            }),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: false,
            }),
        ],
    },

    // TypeScript declarations - svelte
    {
        input: 'src/svelte.ts',
        output: {
            file: 'dist/svelte.d.ts',
            format: 'es',
        },
        external: ['svelte', 'svelte/store'],
        plugins: [dts()],
    },
];
