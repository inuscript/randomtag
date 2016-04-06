import calcBandit from '../bandit/'
import Bandit from '../bandit/instance'
import { App } from './index'
import React, { Component } from 'react'

export default class Container extends Component{
  componentDidMount() {
    new Bandit(25, 170).execute().then(({tags, stats}) => {
      let next = {
        tags: tags,
        stats: stats
      }
      this.setState(next)
    })
    // .catch(e => {
    //   console.error(e)
    // })
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
