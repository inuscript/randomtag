import 'babel-polyfill'
import docReady from 'doc-ready'
// import { App } from "./view/index"
// import { node , Component, mountToDom } from 'vidom/lib/vidom';

import { main } from './view/cycled'
import calcTags from './bandit/'

import Cycle from '@cycle/core'
import { makeDOMDriver} from '@cycle/dom'
import { tags, stats } from './mock'

function startWithServer () {
  let ts = calcTags().then(({tags, stats}) => {
    main({tags, stats})
  }).catch(e => {
    console.error(e)
  })
}
function startWithMock () {
  main({tags, stats})
}
docReady(function () {
  // main({tags, stats})
  // startWithServer()
  startWithMock()
  // let container = document.getElementById('container')
})
