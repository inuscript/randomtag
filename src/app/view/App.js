import React, { Component } from 'react'
import Copy from 'app/view/Copy'
import StatTable from 'app/view/StatTable'
import Links from 'app/view/Links'
import Tags from 'app/view/Tags'

export class App extends Component {
  get tags () {
    return this.allTags.filter(t => {
      return !this.rejected[t]
    }).splice(0, 25)
  }
  constructor (props) {
    super(props)
    this.allTags = []
    this.rejected = {}
  }
  onTagClick (tag) {
    if (this.rejected[tag]) {
      this.rejected[tag] = 0
    } else {
      this.rejected[tag] = 1
    }
    this.forceUpdate() // TODO
  }
  render () {
    let {tags, stats} = this.props
    this.allTags = tags
    return (
      <div>
        <Copy tags={this.tags} />
        <Tags tags={this.tags} onTagClick={ (tag) => this.onTagClick(tag) } />
        <Links />
        <StatTable stats={stats} tags={this.tags} />
      </div>
    )
  }
}
