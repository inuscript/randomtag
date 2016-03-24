import Rx from 'rx';
import Cycle from '@cycle/core';
import {div, table, tr, td, makeDOMDriver, hJSX} from '@cycle/dom';


export function main(sources){
  return {
    DOM: Rx.Observable.just(div("hello"))
  }
}