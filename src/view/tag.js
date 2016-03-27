import {Observable} from 'rx'
import {hJSX} from '@cycle/dom'

function test ({DOM, props}) {
  const actions = {
    clickTag$: DOM.select('.tag-item').events('click').map(ev => tag)
  }
  function model (actions) {
    return
  }
  return {
    DOM: Observable.just('dog').map(tag => <span className='tag-item'>{`#${tag} `}</span>)
  }
}
