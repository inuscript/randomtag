import Rx from 'rx';
import Cycle from '@cycle/core';
import {div, makeDOMDriver, hJSX, li} from '@cycle/dom';

function tagComponent(tag){
  return <span className="tag-item">{tag}</span>
}
function tagsComponent(tags){
  return <div>{ tags.map( tag => tagComponent(tag) ) }</div>
}

export function app({DOM, props}){
  // let state$ = Rx.Observable.from(props.tags) //, (tag) => li([tag]) ) //.mergeAll()
  let props$ = Rx.Observable.just(props)
  console.log(props$.map)
  return {
    DOM: props$.map( ({tags, stats}) => {
      return tagsComponent(tags)
    } )
    // tags$.map( (items) =>{
    //   console.log("====")
    //   console.log(items)
    //   return div(items)
    // })
    // .withLatestFrom(tags$, (tags, v) => {
    //   return div([tags])
    // })
  }
}

export function main(obj){
  let driver = makeDOMDriver('#container')
  Cycle.run(app, {
    DOM: driver,
    props: () => {
      return obj
    }
  })
}
