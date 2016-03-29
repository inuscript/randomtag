/*eslint-disable */
import test from 'ava'
import Rx, {Observable} from 'rx'


test.cb('rx', (t) => {
  // console.log('start')

  let a = Observable.from([1, 2, 3, 4, 5, 6])
  let b = Observable.from([7,8,9,10,11])
  let c = Observable.merge(a, b)
    .filter(n => {
      console.log('filter' + n)
      // only even numbers
      return n % 2 === 0
    })
    .map((n) => n).refCount()
  c.subscribe( (s) => {
    console.log("sub:" + s)
    t.pass() 
    return s
  }, (e) => {}, () => {
    t.end()
  })
})
