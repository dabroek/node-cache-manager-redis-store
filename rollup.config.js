import babel from 'rollup-plugin-babel';

export default {
  input: 'index.js',
  output: {
    format: 'cjs',
    file: 'dist/index.js'
  },
  plugins: [
    babel({
      exclude: 'node_modules/**',
    }),
  ],
};
