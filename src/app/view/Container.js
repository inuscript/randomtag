import buildBandit from 'lib/bandit/'
import { App } from 'app/view/App'
import React, { Component } from 'react'

export default class Container extends Component{
  componentDidMount() {
    buildBandit().then(bandit => {
      bandit.num = 25
      bandit.threshold = 170
      let {tags, tagLabels, stats} = bandit.calc()
      let next = {
        tags,
        tagLabels,
        stats
      }
      this.setState(next)
    })
  }
  constructor(props) {
    super(props)
     this.state = {
      tags: null,
      stats: null
    }
  }
  render () {
    if(this.state.tags && this.state.stats){
      return <App {...this.state } />
    }
    return <div>Loading...</div>
  }
}
