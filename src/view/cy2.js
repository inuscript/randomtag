import {Observable, Subject} from 'rx'
import Cycle from '@cycle/core'
import {makeDOMDriver, hJSX, div} from '@cycle/dom'
import HashTag from './HashTag'
import isolate from '@cycle/isolate'

function hashTagWrapper (DOM, tag) {
  let ht = isolate(HashTag)({ DOM, tag })
  // ht.DOM = ht.DOM.replay(null, 1)
  console.log(ht.DOM)
  return { DOM: ht.DOM, delete$: ht.delete$ }
}

function app ({DOM}) {
  let listActions = {remove$: new Subject()}
  let ht = hashTagWrapper(DOM, 'dog')
  // let ht2 = hashTagWrapper(DOM, 'norfolkterrier')
  // let hashTags = [ht, ht2]
  // let doms = hashTags.map((ht) => ht.DOM)
  // let state$ = Observable.startWith(hashTags)
  // let doms = [ht.DOM, ht2.DOM]
  return {
    DOM: ht.DOM
    // Observable.just(true).map((_) => <div>{doms}</div>)
  }
}
export function main (obj) {
  let driver = makeDOMDriver('#container')
  Cycle.run(app, {
    DOM: driver
  })
}
