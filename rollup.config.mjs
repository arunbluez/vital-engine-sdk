import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import alias from '@rollup/plugin-alias'
import dts from 'rollup-plugin-dts'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const production = !process.env.ROLLUP_WATCH

export default [
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      resolve({
        preferBuiltins: false,
        extensions: ['.ts', '.js', '.json'],
      }),
      alias({
        entries: [
          { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, 'src', '$1') },
          { find: '@', replacement: path.resolve(__dirname, 'src') }
        ]
      }),
      commonjs({
        transformMixedEsModules: true,
        requireReturnsDefault: 'auto',
      }),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        outputToFilesystem: true,
      }),
    ],
    external: [],
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    plugins: [
      resolve({
        preferBuiltins: false,
        extensions: ['.ts', '.js', '.json'],
      }),
      alias({
        entries: [
          { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, 'src', '$1') },
          { find: '@', replacement: path.resolve(__dirname, 'src') }
        ]
      }),
      commonjs({
        transformMixedEsModules: true,
        requireReturnsDefault: 'auto',
      }),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        outputToFilesystem: true,
      }),
    ],
    external: [],
  },
  // UMD build for browser
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'VitalEngine',
      sourcemap: true,
    },
    plugins: [
      resolve({
        preferBuiltins: false,
        extensions: ['.ts', '.js', '.json'],
      }),
      alias({
        entries: [
          { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, 'src', '$1') },
          { find: '@', replacement: path.resolve(__dirname, 'src') }
        ]
      }),
      commonjs({
        transformMixedEsModules: true,
        requireReturnsDefault: 'auto',
      }),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        outputToFilesystem: true,
      }),
    ],
    external: [],
  },
  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [
      alias({
        entries: [
          { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, 'src', '$1') },
          { find: '@', replacement: path.resolve(__dirname, 'src') }
        ]
      }),
      dts()
    ],
  },
]