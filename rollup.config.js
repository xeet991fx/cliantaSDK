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
 * Clianta SDK v${packageJson.version}
 * (c) ${new Date().getFullYear()} Clianta
 * Released under the MIT License.
 */`;

export default [
    // Main builds (UMD, ESM, CJS)
    {
        input: 'src/index.ts',
        output: [
            // UMD build for <script> tag (minified)
            {
                file: 'dist/clianta.umd.min.js',
                format: 'umd',
                name: 'Clianta',
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
                file: 'dist/clianta.umd.js',
                format: 'umd',
                name: 'Clianta',
                banner,
                sourcemap: true,
            },
            // ESM build for modern bundlers
            {
                file: 'dist/clianta.esm.js',
                format: 'esm',
                banner,
                sourcemap: true,
            },
            // CJS build for Node.js / older bundlers
            {
                file: 'dist/clianta.cjs.js',
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

    // TypeScript declarations
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/index.d.ts',
            format: 'es',
        },
        plugins: [dts()],
    },
];
