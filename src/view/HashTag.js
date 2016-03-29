import {Observable} from 'rx'
import {hJSX} from '@cycle/dom'
import combineLatestObj from 'rx-combine-latest-obj'

function intent (DOM, tag) {
  return {
    delete$: DOM.select('.tag-item').events('click').map(ev => {
      console.log(tag)
      return {tag: false}
    })
    // .map((ev) => {
    //   cosnole.log(tag)
    //   return tag
    // })
  }
}

function view (state$) {
  return state$.map((tag) => <span className='tag-item'>{`#${tag} `}</span>)
}

function HashTag ({DOM, tag}) {
  const actions = intent(DOM, tag)
  const state$ = actions.delete$.startWith(tag)
  const vtree$ = view(state$)
  return {
    DOM: vtree$,
    delete$: actions.delete$
  }
}

export default HashTag
