import 'babel-polyfill'
import docReady from 'doc-ready'
import { node, mountToDom } from 'vidom/lib/vidom'
import Container from './view/Container'
docReady(function () {
  let container = document.getElementById('container')
  mountToDom(container, node(Container))
})
