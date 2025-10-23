const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

module.exports = (env, argv) => ({
  mode: argv.mode === 'production' ? 'production' : 'development',
  devtool: argv.mode === 'production' ? false : 'inline-source-map',

  entry: {
    ui: './src/ui/index.tsx',
    code: './src/plugin/index.ts',
  },

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: { chrome: '58' } }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './src/ui/index.html',
      filename: 'ui.html',
      chunks: ['ui'],
      inject: 'body',
      scriptLoading: 'blocking',
    }),
    new HtmlInlineScriptPlugin({
      htmlMatchPattern: [/ui.html$/],
      scriptMatchPattern: [/ui.js$/],
    }),
    new webpack.DefinePlugin({
      __html__: webpack.DefinePlugin.runtimeValue(() => {
        const fs = require('fs');
        const htmlPath = path.resolve(__dirname, 'dist/ui.html');
        if (fs.existsSync(htmlPath)) {
          return JSON.stringify(fs.readFileSync(htmlPath, 'utf-8'));
        }
        return JSON.stringify('');
      }, true),
    }),
  ],
});
