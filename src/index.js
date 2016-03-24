import "babel-polyfill"
import docReady from "doc-ready"
import { App } from "./view/index"
import calcTags from "./bandit/"
import { node , Component, mountToDom } from 'vidom/lib/vidom';

docReady( function(){
  let container = document.getElementById('container')
  let ts = calcTags().then( ({tags, stats}) => {
    container.innerHTML = "" // clean
    mountToDom(container, node(App).attrs({tags, stats}));
  }).catch(e => {
    console.error(e)
  })
})
