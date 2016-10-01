import Storage from 'lib/storage/firebase'
import test from 'ava'

test((t) => {
  console.log(new Storage().media())
})