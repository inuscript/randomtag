import 'babel-polyfill'
import docReady from 'doc-ready'
import Container from 'app/view/Container'
import React from 'react'
import ReactDOM from 'react-dom'

docReady(function () {
  let cnt = document.getElementById('container')
  let cmp = <Container />
  ReactDOM.render(cmp, cnt)
})
