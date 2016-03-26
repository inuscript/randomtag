/** @jsx hJSX */
import Rx, {Observable} from 'rx';
import Cycle from '@cycle/core';
import {makeDOMDriver, hJSX, h} from '@cycle/dom';

function tagComponent(tag){
  return <span className="tag-item">{`#${tag} `}</span>
}
function tagsComponent(tags){
  return <div>{ tags.map( tag => tagComponent(tag) ) }</div>
}

export function app({DOM, props}){
  // let state$ = Rx.Observable.from(props.tags) //, (tag) => li([tag]) ) //.mergeAll()
  let props$ = Observable.just(props)
  // console.log(props$.map)
  return {
    DOM: props$.map( ({tags, stats}) => {
      let tagsView = tagsComponent(tags)
      return <div>
        <h1>Randomtag</h1>
        <div>{ tagsView }</div>
      </div>
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
