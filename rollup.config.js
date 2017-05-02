import babel from 'rollup-plugin-babel';

export default {
  entry: 'index.js',
  format: 'cjs',
  dest: 'dist/index.js',
  plugins: [
    babel({
      exclude: 'node_modules/**',
    }),
  ],
};
