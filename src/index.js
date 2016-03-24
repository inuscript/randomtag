import "babel-polyfill"
import docReady from "doc-ready"
// import { App } from "./view/index"
import { main } from "./view/cycled"
import calcTags from "./bandit/"
import { node , Component, mountToDom } from 'vidom/lib/vidom';

import Cycle from '@cycle/core';
import { makeDOMDriver} from '@cycle/dom';
import {tags, stats} from "./mock"
docReady( function(){
  Cycle.run(main, {DOM: makeDOMDriver('#container')})

  // let container = document.getElementById('container')
  // let ts = calcTags().then( ({tags, stats}) => {
  //   console.log(JSON.stringify(tags, null, 2), JSON.stringify(stats, null, 2))
  //   container.innerHTML = "" // clean
  //   // mountToDom(container, node(App).attrs({tags, stats}));
  //   Cycle.run(main, {DOM: makeDOMDriver('#container')})
  // }).catch(e => {
  //   console.error(e)
  // })
})
