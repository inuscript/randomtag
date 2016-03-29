"use strict"
/** eslint-env: mocha */
const Rx = require('rx')
const Observable = Rx.Observable

const esy = function (label, ob, done) {
  ob.subscribe((s) => {
    return console.log(label , s)
  }, (e) => {}, () => {
    done()
  })
}

describe('rx' , () => {
  it('sand', (done) => {
    let a = Observable.from([1, 2, 3, 4, 5, 6])
    let b = Observable.from([7,8,9,10,11])
    let c = Observable.merge(a, b)
      .filter(n => {
        console.log('filter', n)
        // only even numbers
        return n % 2 === 0
      })
      .map((n) => n)
    c.subscribe( (s) => {
      console.log("sub:", s)
      return s
    }, (e) => {}, () => {
      done()
    })
  })
  it('reply', (done) => {
    let pub = Observable.from([1, 2, 3, 4, 5, 6]).select( n => n)
    .replay((x) => {
      // console.log("inr", x)
      return x
    }, 1)
    // console.log(pub)
    let p = pub.publish()
    // console.log(p)
    // console.log(p)
    let c = p.connect()
    // esy('reply', pub, done)
    c.dispose(function(){
      console.log("aa")
    })
  })
})