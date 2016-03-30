import {Observable} from 'rx'
import {hJSX} from '@cycle/dom'
import combineLatestObj from 'rx-combine-latest-obj'

function intent (DOM, tag) {
  return {
    delete$: DOM.select('.tag-item').events('click').map(ev => {
      return { name: tag.name, enable: false }
    })
    // .map((ev) => {
    //   cosnole.log(tag)
    //   return tag
    // })
  }
}

function view (state$) {
  return state$.map((item) => {
    let label = item.enable ? "enable" : "disable"
    return <span className='tag-item'>{`#${item.name} ${label} `}</span>
  })
}

function HashTag ({DOM, tag}) {
  const item = { name: tag, enable: true}
  const actions = intent(DOM, item)
  const state$ = actions.delete$.startWith(item)
  const vtree$ = view(state$)
  return {
    DOM: vtree$,
    delete$: actions.delete$
  }
}

export default HashTag
