import uuid from 'uuid'

export default () => {
  if(process.env.NODE_ENV === 'test'){
    return 'unique-id'
  }
  return uuid()
}