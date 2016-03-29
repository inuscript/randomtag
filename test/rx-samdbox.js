import Rx, {Observable} from 'rx'

test.cb('rx', (t) => {
  // t.plan(1)
  let a = Observable.merge("a", "b")
  a.subscribe( (a) => {
  }, (err) => {}, () => {
    console.log("aa")
    // t.ok(true)
    t.end()
  })
  // t.ok(true)
  // return a
  // t.ng("aa")
})
