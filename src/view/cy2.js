import {Observable, Subject} from 'rx'
import Cycle from '@cycle/core'
import {makeDOMDriver, hJSX} from '@cycle/dom'
import HashTag from './HashTag'

function app ({DOM}) {
  let ht = HashTag({DOM, tag: 'dog'})
  ht.delete$.publish()
  return {
    DOM: ht.DOM
  }
}
export function main (obj) {
  let driver = makeDOMDriver('#container')
  Cycle.run(app, {
    DOM: driver
  })
}
