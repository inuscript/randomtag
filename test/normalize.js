// import 'babel-polyfill'
import test from 'ava'
import normalize from '../src/lib/normalize'

test((t) => {
  let input = {
    foo: [100, 20, 300],
    baz: [50, 50, 200]
  }
  let n = normalize(input)
  t.same(n, [
    { key: 'foo', values: [ 1, 0, 1 ] },
    { key: 'baz', values: [ 0, 0, 1 ] }
  ])
})

