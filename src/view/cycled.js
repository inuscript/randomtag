import {Observable, Subject} from 'rx'
import Cycle from '@cycle/core'
import {makeDOMDriver, hJSX} from '@cycle/dom'
import Clipboard from 'clipboard'
import HashTag from './HashTag'
import isolate from '@cycle/isolate'

function HashTags ({DOM, tags}) {
  let itemActions = { filter$: new Subject() }
  let tagItems = tags.map(tag => isolate(HashTag)({DOM, tag, itemActions}))
  let tagsView = tagItems.map(item => item.DOM)

  return {
    DOM: <div>{ tagsView }</div>
  }
}

function CopyButton ({DOM, target}) {
  let id = '__copy__button__'
  let clipboard = new Clipboard(`#${id}`)
  return {
    DOM: <button id={id} data-clipboard-target={target} >Copy !</button>
  }
}

export function app ({DOM, props}) {
  // let state$ = Rx.Observable.from(props.tags) //, (tag) => li([tag]) ) //.mergeAll()
  let props$ = Observable.just(props)
  // console.log(props$.map)
  let copyButton = CopyButton({DOM, target: 'foo'})
  return {
    DOM: props$.map(({tags, stats}) => {
      let hashTags = HashTags({DOM, tags: tags})
      return <div>
        <h1>Randomtag</h1>
        { copyButton.DOM }
        { hashTags.DOM }
      </div>
    })
  }
}

export function main (obj) {
  let driver = makeDOMDriver('#container')
  Cycle.run(app, {
    DOM: driver,
    props: () => {
      return obj
    }
  })
}
