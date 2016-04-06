import calcBandit from '../bandit/'
import buildBandit from '../bandit/'
import { App } from './index'
import React, { Component } from 'react'

export default class Container extends Component{
  componentDidMount() {
    buildBandit().then(bandit => {
      bandit.num = 25
      bandit.threshold = 170
      let {tags, stats} = bandit.calc()
      let next = {
        tags: tags,
        stats: stats
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
      return <App tags={this.state.tags} stats={this.state.stats} />
    }
    return <div>Loading...</div>
  }
}
