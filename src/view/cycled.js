/** @jsx hJSX */
import Rx, {Observable} from 'rx';
import Cycle from '@cycle/core';
import {makeDOMDriver, hJSX, h} from '@cycle/dom';
import Clipboard from "clipboard"

function Hashtag({DOM, tag}){
  // const intent = DOM.select('.tag-item').events('click').map( )
  return {
    DOM: <span className="tag-item">{`#${tag} `}</span>
  }
}
function HashTags({DOM, tags}){
  return {
    DOM: <div>{ tags.map( tag => Hashtag({DOM, tag}).DOM ) }</div>
  }
}

function CopyButton({DOM, target}){
  let id = "__copy__button__"
  let clipboard = new Clipboard(`#${id}`)
  return {
    DOM: <button id={id} data-clipboard-target={target} >Copy !</button>
  }
}

export function app({DOM, props}){
  // let state$ = Rx.Observable.from(props.tags) //, (tag) => li([tag]) ) //.mergeAll()
  let props$ = Observable.just(props)
  // console.log(props$.map)
  let copyButton = CopyButton({DOM, target: "foo"})
  return {
    DOM: props$.map( ({tags, stats}) => {
      let hashTags = HashTags({DOM, tags: tags})
      return <div>
        <h1>Randomtag</h1>
        { copyButton.DOM }
        { hashTags.DOM }
      </div>
    } )
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
