import babel from "rollup-plugin-babel"
import npm from "rollup-plugin-npm"
import commonjs from "rollup-plugin-commonjs"


export default {
  entry: "src/index.js",
  format: "umd",
  dest: "dist/index.js",
  plugins: [babel(), npm(), commonjs()]
}