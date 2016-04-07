import buildBandit from 'lib/bandit/'
import { App } from 'app/view/App'
import React, { Component } from 'react'

export default class Container extends Component{
  componentDidMount() {
    buildBandit().then(bandit => {
      bandit.num = 25
      bandit.threshold = 170
      this.setState({
        store: bandit.calc()
      })
    })
  }
  constructor(props) {
    super(props)
     this.state = {
      store: null
    }
  }
  render () {
    if(this.state.store){
      return <App {...this.state.store } />
    }
    return <div>Loading...</div>
  }
}
